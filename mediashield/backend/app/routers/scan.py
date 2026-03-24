"""
Scan router — upload a suspect image and check for matches.
"""

import os
import shutil
from uuid import uuid4
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from PIL import Image

from app.database import get_db
from app.config import VIOLATION_DIR
from app.services.scanner import scan_image

router = APIRouter(prefix="/scan", tags=["Scan"])


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

    return result
