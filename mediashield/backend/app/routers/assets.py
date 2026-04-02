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
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from PIL import Image

from app.database import get_db
from app.config import UPLOAD_DIR, VIDEO_FRAMES
from app.models.asset import Asset
from app.models.violation import Violation
from app.services.fingerprint import compute_phash, compute_embedding
from app.services.watermark import embed_watermark
from app.services import vector_store
from app.services.video_fingerprint import compute_video_fingerprint
from app.services.vector_store import add_video_frames
from app.services.gemini_keywords import (
    generate_keywords_from_images,
    generate_keywords_for_video_frames,
)
from app.services.url_media_fetch import (
    is_video_url,
    download_image_from_url,
    download_video_from_url,
)

router = APIRouter(prefix="/assets", tags=["Assets"])
log = logging.getLogger(__name__)


def _log_asset_keywords(source: str, asset_id: str, keywords: list[str], name: str) -> None:
    if not keywords:
        log.warning(
            "[assets:%s] no AI keywords stored asset_id=%s name=%r — see app.services.gemini_keywords logs "
            "(GEMINI_API_KEY in backend/.env, model, API errors)",
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
async def register_asset(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload and register an original image asset.
    Generates pHash + CLIP embedding, stores in DB + ChromaDB.
    """
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

    keywords = await asyncio.to_thread(
        generate_keywords_from_images,
        [watermarked],
        file.filename or "",
    )
    keywords_json = json.dumps(keywords) if keywords else None
    _log_asset_keywords("register_image", asset_id, keywords, file.filename or "")

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
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    return {
        "id": asset.id,
        "name": asset.name,
        "phash": asset.phash,
        "keywords": asset.keywords_list(),
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "message": "Asset registered successfully — trackable with fingerprints + AI keywords",
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

@router.post("/video")
async def register_video_asset(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload and register an original video asset.
    Extracts VIDEO_FRAMES uniform frames, computes CLIP embeddings for each,
    stores all frame embeddings in ChromaDB video collection.
    """
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

    keywords = await asyncio.to_thread(
        generate_keywords_for_video_frames,
        filepath,
        file.filename or "",
        3,
    )
    keywords_json = json.dumps(keywords) if keywords else None
    _log_asset_keywords("register_video", asset_id, keywords, file.filename or "")

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
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    return {
        "id": asset.id,
        "name": asset.name,
        "phash": asset.phash,
        "asset_type": "video",
        "frame_count": frame_count,
        "keywords": asset.keywords_list(),
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "message": f"Video asset registered with {frame_count} frames + AI keywords",
    }


@router.post("/from-url")
async def register_asset_from_url(
    source_url: str = Query(..., description="http(s) URL to image, video page, or direct video"),
    media_type: str = Query("auto", description="auto | image | video"),
    db: Session = Depends(get_db),
):
    """
    Register an original asset by downloading from a URL (same fingerprints + keywords as file upload).
    """
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

        keywords = await asyncio.to_thread(
            generate_keywords_for_video_frames,
            filepath,
            display_name,
            3,
        )
        keywords_json = json.dumps(keywords) if keywords else None
        _log_asset_keywords("register_url_video", asset_id, keywords, display_name)

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
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        return {
            "id": asset.id,
            "name": asset.name,
            "source_url": source_url,
            "phash": asset.phash,
            "asset_type": "video",
            "frame_count": frame_count,
            "keywords": asset.keywords_list(),
            "created_at": asset.created_at.isoformat() if asset.created_at else None,
            "message": f"Video registered from URL — {frame_count} frames + AI keywords",
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

    watermarked = embed_watermark(image, payload=asset_id)
    watermarked.save(filepath)

    phash = compute_phash(watermarked)
    embedding = compute_embedding(watermarked)

    keywords = await asyncio.to_thread(
        generate_keywords_from_images,
        [watermarked],
        display_name,
    )
    keywords_json = json.dumps(keywords) if keywords else None
    _log_asset_keywords("register_url_image", asset_id, keywords, display_name)

    vector_store.add_embedding(asset_id, embedding)

    asset = Asset(
        id=asset_id,
        name=display_name,
        original_path=filename,
        phash=phash,
        embedding_id=asset_id,
        watermark_key=hashlib.sha256(asset_id.encode("utf-8")).hexdigest()[:32],
        keywords=keywords_json,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    return {
        "id": asset.id,
        "name": asset.name,
        "source_url": source_url,
        "phash": asset.phash,
        "keywords": asset.keywords_list(),
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "message": "Image registered from URL — fingerprints + AI keywords",
    }
