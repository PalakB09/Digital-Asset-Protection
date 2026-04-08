"""
Violations router — list violations and generate DMCA reports.
"""

import os
import mimetypes
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import VIOLATION_DIR, DMCA_DIR
from app.models.violation import Violation
from app.models.asset import Asset
from app.services.dmca import generate_dmca_pdf

router = APIRouter(prefix="/violations", tags=["Violations"])


@router.get("")
async def list_violations(db: Session = Depends(get_db)):
    """List all violations, newest first."""
    violations = db.query(Violation).order_by(Violation.created_at.desc()).all()
    result = []
    for v in violations:
        asset = db.query(Asset).filter(Asset.id == v.asset_id).first()
        result.append({
            **v.to_dict(),
            "asset_name": asset.name if asset else "Unknown",
            "asset_type": asset.asset_type if asset else "image",
        })
    return result


@router.get("/{violation_id}")
async def get_violation(violation_id: str, db: Session = Depends(get_db)):
    """Get a single violation by ID."""
    violation = db.query(Violation).filter(Violation.id == violation_id).first()
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")
    
    asset = db.query(Asset).filter(Asset.id == violation.asset_id).first()
    return {
        **violation.to_dict(),
        "asset_name": asset.name if asset else "Unknown",
        "asset_type": asset.asset_type if asset else "image",
    }


@router.get("/{violation_id}/image")
async def get_violation_image(violation_id: str, db: Session = Depends(get_db)):
    """Serve the violation image."""
    violation = db.query(Violation).filter(Violation.id == violation_id).first()
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")
    
    if violation.image_path.startswith("http://") or violation.image_path.startswith("https://"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(violation.image_path)
        
    filepath = os.path.join(str(VIOLATION_DIR), os.path.basename(violation.image_path))
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image file not found")
    
    mime_type, _ = mimetypes.guess_type(filepath)
    return FileResponse(filepath, media_type=mime_type or "application/octet-stream")


@router.post("/{violation_id}/dmca")
async def create_dmca(violation_id: str, db: Session = Depends(get_db)):
    """Generate a DMCA takedown notice PDF for a violation."""
    try:
        filepath = generate_dmca_pdf(violation_id, db)
        return {
            "message": "DMCA notice generated",
            "violation_id": violation_id,
            "pdf_filename": os.path.basename(filepath),
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{violation_id}/dmca")
async def download_dmca(violation_id: str, db: Session = Depends(get_db)):
    """Download the generated DMCA PDF."""
    violation = db.query(Violation).filter(Violation.id == violation_id).first()
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")
    
    filename = f"dmca_{violation.id[:8]}.pdf"
    filepath = os.path.join(str(DMCA_DIR), filename)
    
    if not os.path.exists(filepath):
        # Generate it if it doesn't exist
        filepath = generate_dmca_pdf(violation_id, db)
    
    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=filename,
    )
