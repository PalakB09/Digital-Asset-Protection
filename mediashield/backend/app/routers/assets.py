"""
Assets router — register and list original images.
"""

import logging
import asyncio
import json
import os
import shutil
import tempfile
import hashlib
import mimetypes
from urllib.parse import urlparse
from uuid import uuid4
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from PIL import Image

from app.database import get_db
from app.config import UPLOAD_DIR, VIDEO_FRAMES, VIOLATION_DIR
from app.models.asset import Asset, AssetRecipient, AssetDistribution
from app.models.violation import Violation, PropagationEdge
from app.services.job_queue import Job, get_queue
from app.services.fingerprint import compute_phash, compute_embedding
from app.services.watermark import embed_watermark, embed_watermark_video
from app.services import vector_store
from app.services.video_fingerprint import compute_video_fingerprint
from app.services.vector_store import add_video_frames
from app.services.gemini_keywords import generate_keywords_from_description
from app.services.url_media_fetch import (
    is_video_url,
    download_image_from_url,
    download_video_from_url,
)

router = APIRouter(prefix="/assets", tags=["Assets"])
log = logging.getLogger(__name__)

DESC_MAX_STORE = 10000


async def _queue_twitter_scrape(asset_id: str) -> str:
    """Kick off an automatic X/Twitter background scrape for a new asset."""
    job = Job(
        job_type="twitter_scrape_asset",
        payload={"asset_id": asset_id},
    )
    await get_queue().push(job)
    return job.id


def _require_description(description: str | None) -> str:
    """Non-empty trimmed user content about the asset (required for registration)."""
    d = (description or "").strip()
    if not d:
        raise HTTPException(
            status_code=400,
            detail="description is required: add a short note about what this asset is (used for discovery keywords)",
        )
    return d[:DESC_MAX_STORE]


def _stored_description(description: str | None) -> str | None:
    d = (description or "").strip()
    if not d:
        return None
    return d[:DESC_MAX_STORE]


async def _keywords_from_description(description: str, title_hint: str) -> tuple[list[str], str | None]:
    """Text-only Gemini from user description (no image/video analysis)."""
    d = (description or "").strip()
    if not d:
        return [], None
    kw = await asyncio.to_thread(
        generate_keywords_from_description,
        d,
        title_hint or "",
    )
    return kw, (json.dumps(kw) if kw else None)


def _log_asset_keywords(
    source: str, asset_id: str, keywords: list[str], name: str, *, had_description: bool
) -> None:
    if not keywords:
        if not had_description:
            log.warning(
                "[assets:%s] no AI keywords asset_id=%s name=%r — add an asset description at registration "
                "(keywords are generated from your text, not from pixels; saves vision API quota)",
                source,
                asset_id,
                (name or "")[:120],
            )
        else:
            log.warning(
                "[assets:%s] no AI keywords stored asset_id=%s name=%r — see app.services.gemini_keywords logs "
                "(GEMINI_API_KEY in backend/.env, model quota, API errors)",
                source,
                asset_id,
                (name or "")[:120],
            )
    else:
        log.info(
            "[assets:%s] stored %d AI keywords asset_id=%s name=%r",
            source,
            len(keywords),
            asset_id,
            (name or "")[:120],
        )


@router.post("")
async def register_asset(
    file: UploadFile = File(...),
    description: str = Form(""),
    db: Session = Depends(get_db),
):
    """
    Upload and register an original image asset.
    Generates pHash + CLIP embedding, stores in DB + ChromaDB.
    Discovery keywords come from the required `description` field (text-only Gemini), not from image pixels.
    """
    desc = _require_description(description)

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted")

    # Save uploaded file
    asset_id = str(uuid4())
    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    filename = f"{asset_id}{ext}"
    filepath = os.path.join(str(UPLOAD_DIR), filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Open image and generate fingerprints
    try:
        image = Image.open(filepath).convert("RGB")
    except Exception as e:
        os.remove(filepath)
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

    # Embed ownership watermark at ingestion time.
    watermarked = embed_watermark(image, payload=asset_id)
    watermarked.save(filepath)

    phash = compute_phash(watermarked)
    embedding = compute_embedding(watermarked)

    desc_stored = _stored_description(desc)
    keywords, keywords_json = await _keywords_from_description(
        desc, file.filename or ""
    )
    _log_asset_keywords(
        "register_image",
        asset_id,
        keywords,
        file.filename or "",
        had_description=bool(desc_stored),
    )

    # Store embedding in ChromaDB
    vector_store.add_embedding(asset_id, embedding)

    # Create DB record
    asset = Asset(
        id=asset_id,
        name=file.filename or "unnamed",
        original_path=filename,
        phash=phash,
        embedding_id=asset_id,
        watermark_key=hashlib.sha256(asset_id.encode("utf-8")).hexdigest()[:32],
        keywords=keywords_json,
        description=desc_stored,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    twitter_job_id = await _queue_twitter_scrape(asset_id)

    return {
        "id": asset.id,
        "name": asset.name,
        "phash": asset.phash,
        "keywords": asset.keywords_list(),
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "description": asset.description,
        "twitter_scan_job_id": twitter_job_id,
        "message": "Asset registered — fingerprints + discovery keywords from your description; Twitter scan queued",
    }


@router.get("")
async def list_assets(db: Session = Depends(get_db)):
    """List all registered assets."""
    assets = db.query(Asset).order_by(Asset.created_at.desc()).all()
    result = []
    for asset in assets:
        violation_count = db.query(Violation).filter(Violation.asset_id == asset.id).count()
        result.append({
            **asset.to_dict(),
            "violation_count": violation_count,
        })
    return result


@router.get("/{asset_id}")
async def get_asset(asset_id: str, db: Session = Depends(get_db)):
    """Get a single asset by ID."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    violation_count = db.query(Violation).filter(Violation.asset_id == asset.id).count()
    return {
        **asset.to_dict(),
        "violation_count": violation_count,
    }


def _safe_remove_file(path: str) -> None:
    try:
        if path and os.path.isfile(path):
            os.remove(path)
    except OSError:
        pass


@router.delete("/{asset_id}")
async def delete_asset(asset_id: str, db: Session = Depends(get_db)):
    """
    Permanently remove an asset: database row, stored original file, Chroma embeddings,
    and all violations / propagation edges that reference this asset.
    """
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    name_preview = (asset.name or "")[:120]
    violations = db.query(Violation).filter(Violation.asset_id == asset_id).all()
    vids = [v.id for v in violations]

    if vids:
        db.query(PropagationEdge).filter(PropagationEdge.violation_id.in_(vids)).delete(
            synchronize_session=False
        )
    db.query(PropagationEdge).filter(PropagationEdge.source_asset_id == asset_id).delete(
        synchronize_session=False
    )

    for v in violations:
        fp = os.path.join(str(VIOLATION_DIR), os.path.basename(v.image_path or ""))
        _safe_remove_file(fp)
        db.delete(v)

    is_video = (asset.asset_type or "").lower() == "video"
    if is_video:
        n = asset.frame_count if (asset.frame_count and asset.frame_count > 0) else VIDEO_FRAMES
        vector_store.delete_video_frames(asset_id, n)
    else:
        vector_store.delete_embedding(asset_id)

    orig_path = os.path.join(str(UPLOAD_DIR), os.path.basename(asset.original_path))
    _safe_remove_file(orig_path)

    db.delete(asset)
    db.commit()

    log.info("[assets:delete] removed asset_id=%s name=%r", asset_id, name_preview)
    return {"deleted": True, "id": asset_id}


@router.get("/{asset_id}/image")
async def get_asset_image(asset_id: str, db: Session = Depends(get_db)):
    """Serve the original image for an asset."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    filepath = os.path.join(str(UPLOAD_DIR), os.path.basename(asset.original_path))
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image file not found")
    
    mime_type, _ = mimetypes.guess_type(filepath)
    return FileResponse(filepath, media_type=mime_type or "application/octet-stream")


VIDEO_MIME_TYPES = {"video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo", "video/webm"}


class RegisterFromUrlRequest(BaseModel):
    source_url: str = Field(..., min_length=8, description="http(s) URL to image, video page, or direct video")
    media_type: str = Field("auto", description="auto | image | video")
    description: str = Field("", max_length=DESC_MAX_STORE, description="Required: what this asset is")

    @field_validator("description")
    @classmethod
    def description_required(cls, v: str) -> str:
        s = (v or "").strip()
        if not s:
            raise ValueError("description is required: briefly describe this asset")
        return s[:DESC_MAX_STORE]


@router.post("/video")
async def register_video_asset(
    file: UploadFile = File(...),
    description: str = Form(""),
    db: Session = Depends(get_db),
):
    """
    Upload and register an original video asset.
    Extracts VIDEO_FRAMES uniform frames, computes CLIP embeddings for each,
    stores all frame embeddings in ChromaDB video collection.
    Keywords are generated from the required `description` (text-only), not from sampled frames.
    """
    desc = _require_description(description)

    if not file.content_type or file.content_type not in VIDEO_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Only video files are accepted (mp4, mpeg, mov, avi, webm)")

    asset_id = str(uuid4())
    ext = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    filename = f"{asset_id}{ext}"
    filepath = os.path.join(str(UPLOAD_DIR), filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        embeddings, phash, frame_count = compute_video_fingerprint(filepath, VIDEO_FRAMES)
    except Exception as e:
        os.remove(filepath)
        raise HTTPException(status_code=400, detail=f"Could not process video: {str(e)}")

    desc_stored = _stored_description(desc)
    keywords, keywords_json = await _keywords_from_description(
        desc, file.filename or ""
    )
    _log_asset_keywords(
        "register_video",
        asset_id,
        keywords,
        file.filename or "",
        had_description=bool(desc_stored),
    )

    # Store all frame embeddings in video collection
    add_video_frames(asset_id, embeddings)

    # Create DB record (phash = middle frame, asset_type = "video")
    asset = Asset(
        id=asset_id,
        name=file.filename or "unnamed",
        original_path=filename,
        phash=phash,
        embedding_id=asset_id,
        asset_type="video",
        frame_count=frame_count,
        keywords=keywords_json,
        description=desc_stored,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    twitter_job_id = await _queue_twitter_scrape(asset_id)

    return {
        "id": asset.id,
        "name": asset.name,
        "phash": asset.phash,
        "asset_type": "video",
        "frame_count": frame_count,
        "keywords": asset.keywords_list(),
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "description": asset.description,
        "twitter_scan_job_id": twitter_job_id,
        "message": f"Video registered — {frame_count} frames embedded; discovery keywords from your description; Twitter scan queued",
    }


@router.post("/from-url")
async def register_asset_from_url(body: RegisterFromUrlRequest, db: Session = Depends(get_db)):
    """
    Register an original asset by downloading from a URL (same fingerprints as file upload).
    Keywords are generated from `description` (text-only Gemini), not from downloaded media pixels.
    """
    source_url = body.source_url.strip()
    media_type = (body.media_type or "auto").strip().lower() or "auto"
    description = body.description

    if not source_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="source_url must be http/https")

    is_video = False
    if media_type == "video":
        is_video = True
    elif media_type == "image":
        is_video = False
    else:
        is_video = is_video_url(source_url)

    display_name = source_url[:200]

    if is_video:
        tmp_video = download_video_from_url(source_url)
        if not tmp_video:
            raise HTTPException(status_code=400, detail="Could not download video from URL (yt-dlp may be required)")

        asset_id = str(uuid4())
        _, ext = os.path.splitext(tmp_video)
        ext = ext if ext else ".mp4"
        filename = f"{asset_id}{ext}"
        filepath = os.path.join(str(UPLOAD_DIR), filename)
        try:
            shutil.move(tmp_video, filepath)
        except Exception:
            if os.path.exists(tmp_video):
                os.remove(tmp_video)
            raise HTTPException(status_code=500, detail="Failed to save downloaded video")

        try:
            embeddings, phash, frame_count = compute_video_fingerprint(filepath, VIDEO_FRAMES)
        except Exception as e:
            os.remove(filepath)
            raise HTTPException(status_code=400, detail=f"Could not process video: {str(e)}")

        desc_stored = _stored_description(description)
        keywords, keywords_json = await _keywords_from_description(description, display_name)
        _log_asset_keywords(
            "register_url_video",
            asset_id,
            keywords,
            display_name,
            had_description=bool(desc_stored),
        )

        add_video_frames(asset_id, embeddings)

        asset = Asset(
            id=asset_id,
            name=display_name,
            original_path=filename,
            phash=phash,
            embedding_id=asset_id,
            asset_type="video",
            frame_count=frame_count,
            keywords=keywords_json,
            description=desc_stored,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        twitter_job_id = await _queue_twitter_scrape(asset_id)

        return {
            "id": asset.id,
            "name": asset.name,
            "source_url": source_url,
            "phash": asset.phash,
            "asset_type": "video",
            "frame_count": frame_count,
            "keywords": asset.keywords_list(),
            "created_at": asset.created_at.isoformat() if asset.created_at else None,
            "description": asset.description,
            "twitter_scan_job_id": twitter_job_id,
            "message": f"Video registered from URL — {frame_count} frames; keywords from your description; Twitter scan queued",
        }

    # Image path
    tmp_img, content_type = download_image_from_url(source_url)
    if not tmp_img:
        raise HTTPException(status_code=400, detail="Unable to download image from URL")

    if content_type and not content_type.startswith("image/"):
        os.remove(tmp_img)
        raise HTTPException(status_code=400, detail="URL does not resolve to an image")

    asset_id = str(uuid4())
    ext = os.path.splitext(urlparse(source_url).path)[1] or ".jpg"
    if ext.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    filename = f"{asset_id}{ext}"
    filepath = os.path.join(str(UPLOAD_DIR), filename)

    try:
        shutil.move(tmp_img, filepath)
    except Exception:
        if os.path.exists(tmp_img):
            os.remove(tmp_img)
        raise HTTPException(status_code=500, detail="Failed to save downloaded image")

    try:
        image = Image.open(filepath).convert("RGB")
    except Exception as e:
        os.remove(filepath)
        raise HTTPException(status_code=400, detail=f"Invalid image from URL: {str(e)}")

    # Watermark base injection logic remains unmodified
    watermarked = embed_watermark(image, payload=asset_id)
    watermarked.save(filepath)

    phash = compute_phash(watermarked)
    embedding = compute_embedding(watermarked)

    desc_stored = _stored_description(description)
    keywords, keywords_json = await _keywords_from_description(description, display_name)
    _log_asset_keywords(
        "register_url_image",
        asset_id,
        keywords,
        display_name,
        had_description=bool(desc_stored),
    )

    vector_store.add_embedding(asset_id, embedding)

    asset = Asset(
        id=asset_id,
        name=display_name,
        original_path=filename,
        phash=phash,
        embedding_id=asset_id,
        watermark_key=hashlib.sha256(asset_id.encode("utf-8")).hexdigest()[:32],
        keywords=keywords_json,
        description=desc_stored,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    twitter_job_id = await _queue_twitter_scrape(asset_id)

    return {
        "id": asset.id,
        "name": asset.name,
        "source_url": source_url,
        "phash": asset.phash,
        "keywords": asset.keywords_list(),
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "description": asset.description,
        "twitter_scan_job_id": twitter_job_id,
        "message": "Image registered from URL — fingerprints; discovery keywords from your description; Twitter scan queued",
    }


class RecipientListRequest(BaseModel):
    recipients: list[dict] # expects dict with "name" and "identifier" mapping

@router.post("/{asset_id}/recipients")
async def add_recipients(asset_id: str, body: RecipientListRequest, db: Session = Depends(get_db)):
    """Add distribution recipients for unique forensic watermarking."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    added = []
    for r in body.recipients:
        name = r.get("name", "").strip()
        identifier = r.get("identifier", "").strip()
        if not name or not identifier:
            continue
            
        uuid_str = str(uuid4())
        # To make watermark robust, uuid string fits nicely in 64 byte payload capability
        recipient = AssetRecipient(
            id=str(uuid4()),
            asset_id=asset_id,
            recipient_name=name,
            recipient_identifier=identifier,
            watermark_id=uuid_str
        )
        db.add(recipient)
        added.append(recipient)
    
    if len(added) > 0:
        db.commit()
    
    return {"message": f"Added {len(added)} recipients"}

@router.get("/{asset_id}/distributions")
async def list_distributions(asset_id: str, db: Session = Depends(get_db)):
    """List all recipients and their active uniquely-watermarked distributions."""
    recipients = db.query(AssetRecipient).filter(AssetRecipient.asset_id == asset_id).all()
    distributions = db.query(AssetDistribution).filter(AssetDistribution.asset_id == asset_id).all()
    
    dist_map = {d.recipient_id: d for d in distributions}
    
    results = []
    for r in recipients:
        d = dist_map.get(r.id)
        results.append({
            "recipient_id": r.id,
            "recipient_name": r.recipient_name,
            "recipient_identifier": r.recipient_identifier,
            "watermark_id": r.watermark_id,
            "generated": d is not None,
            "distribution_url": f"/api/assets/download/{d.id}" if d else None,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
        
    return results

from app.config import DISTRIBUTIONS_DIR

@router.post("/{asset_id}/generate-protected")
async def generate_protected_copies(asset_id: str, db: Session = Depends(get_db)):
    """Reads original asset and dynamically generates copies for any recipient missing a generated watermark."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    filepath = str(UPLOAD_DIR / asset.original_path)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Original asset file missing")
        
    recipients = db.query(AssetRecipient).filter(AssetRecipient.asset_id == asset_id).all()
    distributions = db.query(AssetDistribution).filter(AssetDistribution.asset_id == asset_id).all()
    
    generated_recipient_ids = {d.recipient_id for d in distributions}
    pending = [r for r in recipients if r.id not in generated_recipient_ids]
    
    if not pending:
        return {"message": "All recipients already have generated distributions"}
        
    is_video = (asset.asset_type == "video")
    
    generated_count = 0
    for recipient in pending:
        ext = os.path.splitext(filepath)[1]
        dist_filename = f"{recipient.watermark_id}{ext}"
        dist_filepath = str(DISTRIBUTIONS_DIR / dist_filename)
        
        try:
            if is_video:
                success = embed_watermark_video(filepath, dist_filepath, payload=recipient.watermark_id)
                if not success:
                    raise Exception("Video watermarking failed")
            else:
                image = Image.open(filepath).convert("RGB")
                watermarked = embed_watermark(image, payload=recipient.watermark_id)
                watermarked.save(dist_filepath)
                
            dist = AssetDistribution(
                asset_id=asset_id,
                recipient_id=recipient.id,
                watermarked_file_path=dist_filename,
                watermark_id=recipient.watermark_id
            )
            db.add(dist)
            generated_count += 1
        except Exception as e:
            log.error("Failed to generate protected copy for recipient %s: %s", recipient.id, str(e))
            
    db.commit()
    return {"message": f"Generated {generated_count} new protected copies"}

@router.get("/download/{distribution_id}")
async def download_distribution(distribution_id: str, db: Session = Depends(get_db)):
    dist = db.query(AssetDistribution).filter(AssetDistribution.id == distribution_id).first()
    if not dist:
        raise HTTPException(status_code=404, detail="Distribution not found")
        
    filepath = str(DISTRIBUTIONS_DIR / dist.watermarked_file_path)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File missing")
        
    mime_type, _ = mimetypes.guess_type(filepath)
    return FileResponse(filepath, media_type=mime_type or "application/octet-stream", filename=f"protected_{dist.watermarked_file_path}")

