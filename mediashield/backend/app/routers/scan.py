"""
Scan router — upload a suspect image and check for matches.
"""

import os
import shutil
import tempfile
from uuid import uuid4
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from PIL import Image

from app.database import get_db
from app.config import VIOLATION_DIR
from app.services.scanner import scan_image
from app.services.video_matcher import match_video
from app.services.alerts import alert_manager
from app.services.url_media_fetch import is_video_url, download_image_from_url

router = APIRouter(prefix="/scan", tags=["Scan"])

@router.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    await alert_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except WebSocketDisconnect:
        alert_manager.disconnect(websocket)



@router.post("")
async def scan_uploaded_image(
    file: UploadFile = File(...),
    source_url: str = "upload",
    platform: str = "unknown",
    db: Session = Depends(get_db),
):
    """
    Upload a suspect image and scan it against all registered assets.
    If a match is found, creates a violation record.
    """
    # Validate
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted")

    # Save the suspect image to violations dir
    scan_id = str(uuid4())
    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    filename = f"scan_{scan_id}{ext}"
    filepath = os.path.join(str(VIOLATION_DIR), filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Open image
    try:
        image = Image.open(filepath).convert("RGB")
    except Exception as e:
        os.remove(filepath)
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

    # Run scan
    result = scan_image(
        image=image,
        db=db,
        source_url=source_url,
        platform=platform,
        image_path=filename,
    )

    # If no match, clean up the saved file
    if not result["matched"]:
        os.remove(filepath)
    else:
        await alert_manager.broadcast(
            {
                "type": "violation_alert",
                "violation": {k: v for k, v in result.items() if k != "details"},
            }
        )

    return result


VIDEO_MIME_TYPES = {"video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo", "video/webm"}


@router.post("/video")
async def scan_uploaded_video(
    file: UploadFile = File(...),
    source_url: str = "upload",
    platform: str = "unknown",
    db: Session = Depends(get_db),
):
    """
    Upload a suspect video and scan it against all registered video assets.
    Uses frame-set similarity (CLIP embeddings + average max-similarity).
    If a match is found, creates a violation record.
    """
    if not file.content_type or file.content_type not in VIDEO_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Only video files are accepted")

    scan_id = str(uuid4())
    ext = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    filename = f"scan_{scan_id}{ext}"
    filepath = os.path.join(str(VIOLATION_DIR), filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Run video matcher (adaptive frame count for short pirated clips)
    result = match_video(video_path=filepath, db=db, n_frames=None)

    if not result.matched:
        os.remove(filepath)
        return {
            "matched": False,
            "message": "No matching video asset found",
            "details": result.details,
        }

    # Create violation record (reuse existing Violation model)
    from app.models.violation import Violation, PropagationEdge
    violation_id = str(uuid4())
    violation = Violation(
        id=violation_id,
        asset_id=result.asset_id,
        source_url=source_url,
        platform=platform,
        confidence=result.confidence,
        match_tier=result.match_tier,
        match_type=result.match_type,
        image_path=filename,
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
    db.refresh(violation)

    return {
        "matched": True,
        "violation_id": violation.id,
        "asset_id": result.asset_id,
        "asset_name": result.asset_name,
        "confidence": result.confidence,
        "match_tier": result.match_tier,
        "match_type": result.match_type,
        "details": result.details,
    }


@router.post("/url")
async def scan_from_url(
    source_url: str,
    platform: str = "unknown",
    media_type: str = "auto",
    db: Session = Depends(get_db),
    async_mode: bool = False,
):
    """
    Scan suspect media directly from a URL.

    Supports direct image URLs and video-style URLs (including YouTube links).

    Query params:
      - async=true  → always queue and return job_id immediately
      - (default)   → sync for images, auto-fallback to async for video URLs
    """
    if not source_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="source_url must be an http/https URL")

    is_video = False
    if media_type == "video":
        is_video = True
    elif media_type == "image":
        is_video = False
    else:
        is_video = is_video_url(source_url)

    # ── Dedup check ──────────────────────────────────────────────
    from app.services.dedup import is_duplicate as dedup_check, hash_url, mark_seen
    url_hash = hash_url(source_url)
    if dedup_check(url_hash):
        return {
            "status": "completed",
            "matched": False,
            "message": "Duplicate URL — already processed recently",
            "deduplicated": True,
        }

    # ── Forced async  OR  auto-fallback for video URLs ───────────
    if async_mode or is_video:
        from app.services.job_queue import Job, get_queue
        job = Job(
            job_type="scan_url_video" if is_video else "scan_url_image",
            payload={
                "source_url": source_url,
                "platform": platform,
            },
        )
        queue = get_queue()
        await queue.push(job)
        return {
            "status": "queued",
            "job_id": job.id,
            "message": "Processing in background",
        }

    # ── Sync image path (preserved from original) ────────────────
    image_path, content_type = download_image_from_url(source_url)
    if not image_path:
        raise HTTPException(status_code=400, detail="Unable to download image from URL")

    if content_type and not content_type.startswith("image/"):
        if os.path.exists(image_path):
            os.remove(image_path)
        raise HTTPException(status_code=400, detail="URL does not point to an image")

    scan_id = str(uuid4())
    filename = f"scan_{scan_id}.jpg"
    violation_filepath = os.path.join(str(VIOLATION_DIR), filename)
    shutil.move(image_path, violation_filepath)

    try:
        image = Image.open(violation_filepath).convert("RGB")
    except Exception as e:
        if os.path.exists(violation_filepath):
            os.remove(violation_filepath)
        raise HTTPException(status_code=400, detail=f"Invalid image from URL: {str(e)}")

    result = scan_image(
        image=image,
        db=db,
        source_url=source_url,
        platform=platform,
        image_path=filename,
    )

    if result.get("matched"):
        await alert_manager.broadcast(
            {
                "type": "violation_alert",
                "violation": {k: v for k, v in result.items() if k != "details"},
            }
        )
        mark_seen(url_hash)
        return {"status": "completed", **result}
    else:
        if os.path.exists(violation_filepath):
            os.remove(violation_filepath)
        mark_seen(url_hash)
        return {"status": "completed", **result}

