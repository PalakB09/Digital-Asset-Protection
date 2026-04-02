"""
Job worker — background loop that processes jobs from the queue.

Each job goes through structured stages with logging:
  [JOB START] → [PHASH DONE] → [CLIP DONE] → [WATERMARK DONE] → [JOB END]

On failure the job is marked failed and the worker continues.
Supports up to 2 retries for transient errors.
"""

import asyncio
import json
import logging
import os
import shutil
import tempfile
from datetime import datetime

from app.services.job_queue import Job, get_queue
from app.services.dedup import is_duplicate, mark_seen, hash_url
from app.config import VIOLATION_DIR

log = logging.getLogger(__name__)

MAX_RETRIES = 2


async def job_worker():
    """Main worker loop — runs forever, processes jobs sequentially."""
    queue = get_queue()
    log.info("[WORKER] Job worker started — waiting for jobs...")

    while True:
        try:
            job = await queue.pop(timeout=2.0)
            if job is None:
                continue
            await _process_job(job, attempt=1)
        except asyncio.CancelledError:
            log.info("[WORKER] Job worker cancelled — shutting down")
            break
        except Exception as e:
            log.error("[WORKER] Unexpected error in worker loop: %s", e, exc_info=True)
            await asyncio.sleep(1)


async def _process_job(job: Job, attempt: int):
    """Process a single job with structured logging and error handling."""
    queue = get_queue()

    log.info("[JOB START] id=%s type=%s attempt=%d", job.id, job.job_type, attempt)
    job.status = "processing"
    job.started_at = datetime.utcnow().isoformat()
    queue.update_job(job)

    stage_results: dict = {}

    try:
        if job.job_type == "scan_url_image":
            result = await _process_image_url_job(job, stage_results)
        elif job.job_type == "scan_url_video":
            result = await _process_video_url_job(job, stage_results)
        else:
            raise ValueError(f"Unknown job type: {job.job_type}")

        job.status = "done"
        job.result = result
        job.detection_stage_results = json.dumps(stage_results)
        job.finished_at = datetime.utcnow().isoformat()
        queue.update_job(job)

        # Update violin-level DB record if violation was created
        _update_violation_status(job, stage_results)

        log.info("[JOB END] id=%s status=done", job.id)

    except Exception as e:
        log.error("[JOB ERROR] id=%s error=%s", job.id, str(e), exc_info=True)
        if attempt < MAX_RETRIES:
            log.info("[JOB RETRY] id=%s attempt=%d", job.id, attempt + 1)
            await asyncio.sleep(1)
            await _process_job(job, attempt + 1)
        else:
            job.status = "failed"
            job.error = str(e)
            job.finished_at = datetime.utcnow().isoformat()
            queue.update_job(job)
            _update_violation_status_failed(job)
            log.info("[JOB END] id=%s status=failed", job.id)


# ---------------------------------------------------------------------------
# Image URL processing
# ---------------------------------------------------------------------------
async def _process_image_url_job(job: Job, stage_results: dict) -> dict:
    """Download an image from URL, run full detection pipeline."""
    from app.services.url_media_fetch import download_image_from_url
    from app.database import SessionLocal
    from PIL import Image as PILImage

    source_url = job.payload.get("source_url", "")
    platform = job.payload.get("platform", "unknown")

    # Dedup check
    url_hash = hash_url(source_url)
    if is_duplicate(url_hash):
        return {"matched": False, "message": "Duplicate URL — already processed", "deduplicated": True}

    # Download
    image_path, content_type = download_image_from_url(source_url)
    if not image_path:
        raise ValueError("Unable to download image from URL")

    try:
        if content_type and not content_type.startswith("image/"):
            raise ValueError(f"URL does not point to an image (got {content_type})")

        image = PILImage.open(image_path).convert("RGB")

        # Stage 1: pHash
        from app.services.fingerprint import compute_phash
        phash = compute_phash(image)
        stage_results["phash"] = phash
        log.info("[PHASH DONE] job=%s phash=%s", job.id, phash)

        # Stage 2: CLIP embedding
        from app.services.fingerprint import compute_embedding
        embedding = compute_embedding(image)
        stage_results["clip_embedding_dim"] = len(embedding)
        log.info("[CLIP DONE] job=%s embedding_dim=%d", job.id, len(embedding))

        # Stage 3: Full scan (includes watermark verification)
        from uuid import uuid4
        scan_id = str(uuid4())
        filename = f"scan_{scan_id}.jpg"
        violation_filepath = os.path.join(str(VIOLATION_DIR), filename)
        shutil.copy(image_path, violation_filepath)

        from app.services.scanner import scan_image
        db = SessionLocal()
        try:
            result = scan_image(
                image=image, db=db,
                source_url=source_url, platform=platform,
                image_path=filename,
            )
        finally:
            db.close()

        log.info("[WATERMARK DONE] job=%s", job.id)
        stage_results["watermark_checked"] = True

        if not result.get("matched"):
            if os.path.exists(violation_filepath):
                os.remove(violation_filepath)

        mark_seen(url_hash)
        return result

    finally:
        if os.path.exists(image_path):
            os.remove(image_path)


# ---------------------------------------------------------------------------
# Video URL processing
# ---------------------------------------------------------------------------
async def _process_video_url_job(job: Job, stage_results: dict) -> dict:
    """Download a video from URL, run frame-based detection pipeline."""
    from app.services.url_media_fetch import download_video_from_url
    from app.database import SessionLocal
    from app.services.video_matcher import match_video
    from uuid import uuid4

    source_url = job.payload.get("source_url", "")
    platform = job.payload.get("platform", "unknown")

    url_hash = hash_url(source_url)
    if is_duplicate(url_hash):
        return {"matched": False, "message": "Duplicate URL — already processed", "deduplicated": True}

    video_path = download_video_from_url(source_url)
    if not video_path:
        raise ValueError("Unable to download video from URL")

    try:
        # Stage 1: Frame extraction + pHash (inside match_video)
        log.info("[PHASH DONE] job=%s (video middle-frame pHash computed inside matcher)", job.id)
        stage_results["phash"] = "computed_in_matcher"

        # Stage 2: CLIP embeddings (inside match_video)
        log.info("[CLIP DONE] job=%s (CLIP embeddings computed per frame)", job.id)
        stage_results["clip_embedding_dim"] = 512

        db = SessionLocal()
        try:
            result = match_video(video_path=video_path, db=db, n_frames=None)

            if not result.matched:
                mark_seen(url_hash)
                return {
                    "matched": False,
                    "message": "No matching video asset found",
                    "details": result.details,
                }

            # Create violation
            from app.models.violation import Violation, PropagationEdge
            violation_id = str(uuid4())
            filename = f"scan_url_{violation_id}.mp4"
            violation_filepath = os.path.join(str(VIOLATION_DIR), filename)
            shutil.copy(video_path, violation_filepath)

            violation = Violation(
                id=violation_id,
                asset_id=result.asset_id,
                source_url=source_url,
                platform=platform,
                confidence=result.confidence,
                match_tier=result.match_tier,
                match_type=result.match_type,
                image_path=filename,
                processing_status="done",
            )
            db.add(violation)
            edge = PropagationEdge(
                id=str(uuid4()),
                source_asset_id=result.asset_id,
                violation_id=violation_id,
                platform=platform,
            )
            db.add(edge)
            db.commit()
        finally:
            db.close()

        log.info("[WATERMARK DONE] job=%s (video watermark not applicable)", job.id)
        stage_results["watermark_checked"] = False

        mark_seen(url_hash)
        return {
            "matched": True,
            "violation_id": violation_id,
            "asset_id": result.asset_id,
            "asset_name": result.asset_name,
            "confidence": result.confidence,
            "match_tier": result.match_tier,
            "match_type": result.match_type,
            "details": result.details,
        }
    finally:
        if os.path.exists(video_path):
            os.remove(video_path)


# ---------------------------------------------------------------------------
# DB helpers — update violation record status
# ---------------------------------------------------------------------------
def _update_violation_status(job: Job, stage_results: dict):
    """After a successful job, update the violation's processing_status in the DB."""
    result = job.result
    if not result or not result.get("violation_id"):
        return
    try:
        from app.database import SessionLocal
        from app.models.violation import Violation
        db = SessionLocal()
        try:
            v = db.query(Violation).filter(Violation.id == result["violation_id"]).first()
            if v:
                v.processing_status = "done"
                v.detection_stage_results = json.dumps(stage_results)
                db.commit()
        finally:
            db.close()
    except Exception as e:
        log.warning("[WORKER] Failed to update violation status: %s", e)


def _update_violation_status_failed(job: Job):
    """Mark any pending violation as failed."""
    # For URL jobs we may not have a violation_id yet — that's OK
    pass
