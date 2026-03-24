"""
Scanner service — accepts an image, runs it through the matcher,
and creates violation + propagation records on match.
"""

from uuid import uuid4
from PIL import Image
from sqlalchemy.orm import Session

from app.models.violation import Violation, PropagationEdge
from app.services.matcher import match_image, MatchResult


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

    # Create violation record
    violation_id = str(uuid4())
    violation = Violation(
        id=violation_id,
        asset_id=result.asset_id,
        source_url=source_url,
        platform=platform,
        confidence=result.confidence,
        match_tier=result.match_tier,
        match_type=result.match_type,
        image_path=image_path,
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
        "match_tier": result.match_tier,
        "match_type": result.match_type,
        "details": result.details,
    }
