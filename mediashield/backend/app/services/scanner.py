"""
Scanner service — accepts an image, runs it through the matcher,
and creates violation + propagation records on match.
"""

from uuid import uuid4
from PIL import Image
from sqlalchemy.orm import Session

from app.models.violation import Violation, PropagationEdge
from app.services.matcher import match_image, MatchResult
from app.services.watermark import extract_watermark


def scan_image(
    image: Image.Image,
    db: Session,
    source_url: str = "upload",
    platform: str = "unknown",
    image_path: str = "",
) -> dict:
    """
    Scan an image against all registered assets.
    
    If a match is found, creates a Violation and PropagationEdge record.
    
    Returns a dict with scan results.
    """
    # Run through the tiered matcher
    result: MatchResult = match_image(image, db)

    if not result.matched:
        return {
            "matched": False,
            "message": "No matching asset found",
            "details": result.details,
        }

    # L3 watermark verification (highest-confidence attribution when present)
    extracted = extract_watermark(image)
    watermark_verified = extracted == result.asset_id
    attribution = extracted if watermark_verified else None
    match_tier = "VERIFIED" if watermark_verified else result.match_tier
    match_type = "watermark" if watermark_verified else result.match_type

    # Create violation record
    violation_id = str(uuid4())
    violation = Violation(
        id=violation_id,
        asset_id=result.asset_id,
        source_url=source_url,
        platform=platform,
        confidence=result.confidence,
        match_tier=match_tier,
        match_type=match_type,
        image_path=image_path,
        watermark_verified=watermark_verified,
        attribution=attribution,
    )
    db.add(violation)

    # Create propagation edge
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
        "match_tier": match_tier,
        "match_type": match_type,
        "watermark_verified": watermark_verified,
        "attribution": attribution,
        "details": result.details,
    }
