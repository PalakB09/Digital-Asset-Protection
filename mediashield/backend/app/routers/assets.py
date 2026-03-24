"""
Assets router — register and list original images.
"""

import os
import shutil
from uuid import uuid4
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from PIL import Image

from app.database import get_db
from app.config import UPLOAD_DIR
from app.models.asset import Asset
from app.models.violation import Violation
from app.services.fingerprint import compute_phash, compute_embedding
from app.services import vector_store

router = APIRouter(prefix="/assets", tags=["Assets"])


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

    phash = compute_phash(image)
    embedding = compute_embedding(image)

    # Store embedding in ChromaDB
    vector_store.add_embedding(asset_id, embedding)

    # Create DB record
    asset = Asset(
        id=asset_id,
        name=file.filename or "unnamed",
        original_path=filename,
        phash=phash,
        embedding_id=asset_id,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    return {
        "id": asset.id,
        "name": asset.name,
        "phash": asset.phash,
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "message": "Asset registered successfully",
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
    
    return FileResponse(filepath, media_type="image/jpeg")
