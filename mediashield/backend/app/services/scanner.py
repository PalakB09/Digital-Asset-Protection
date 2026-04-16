"""
Scanner service — accepts an image, runs it through the matcher,
and creates violation + propagation records on match.
"""

from uuid import uuid4
import json
import numpy as np
from PIL import Image
from sqlalchemy.orm import Session
from skimage.metrics import structural_similarity as ssim

from app.models.violation import Violation, PropagationEdge
from app.models.asset import AssetRecipient, Asset
from app.services.matcher import match_image, MatchResult
from app.services.watermark import extract_watermark


def scan_image(
    image: Image.Image,
    db: Session,
    source_url: str = "upload",
    platform: str = "unknown",
    image_path: str = "",
    context_text: str | None = None,
) -> dict:
    """
    Scan an image against all registered assets.
    
    If a match is found, creates a Violation and PropagationEdge record.
    
    Returns a dict with scan results.
    """

    # Run through the tiered matcher
    result: MatchResult = match_image(image, db, context_text=context_text)

    # -------------------------------
    # Detection Stage Tracking
    # -------------------------------
    stage_results = {
        "phash": False,
        "clip": False,
        "watermark": False,
        "hybrid": False
    }

    if result.match_type == "phash":
        stage_results["phash"] = True
    elif result.match_type == "clip":
        stage_results["clip"] = True
    elif result.match_type == "hybrid":
        stage_results["hybrid"] = True
        stage_results["phash"] = True  # hybrid includes phash

    if not result.matched:
        return {
            "matched": False,
            "message": "No matching asset found",
            "details": result.details,
        }

    # -------------------------------
    # Watermark Verification (L3)
    # -------------------------------
    extracted = extract_watermark(image)

    watermark_verified = False
    attribution = None
    leaked_by = None

    if extracted:
        stage_results["watermark"] = True

        if extracted == result.asset_id:
            watermark_verified = True
            attribution = extracted
        else:
            recipient = db.query(AssetRecipient).filter(
                AssetRecipient.watermark_id == extracted
            ).first()
            if recipient:
                watermark_verified = True
                attribution = extracted
                leaked_by = recipient.recipient_name

    match_tier = "VERIFIED" if watermark_verified else result.match_tier
    match_type = "watermark" if watermark_verified else result.match_type

    # -------------------------------
    # SSIM Computation
    # -------------------------------
    ssim_score = None
    try:
        asset = db.query(Asset).filter(Asset.id == result.asset_id).first()

        if asset and asset.original_path:
            original = Image.open(asset.original_path).convert("RGB").resize((256, 256))
            candidate_resized = image.convert("RGB").resize((256, 256))

            ssim_score = float(ssim(
                np.array(original),
                np.array(candidate_resized),
                channel_axis=2,
                data_range=255
            ))
    except Exception:
        ssim_score = None

    # -------------------------------
    # Create Violation Record
    # -------------------------------
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
        leaked_by=leaked_by,

        # New fields
        detection_stage_results=json.dumps(stage_results),
        phash_distance=result.phash_distance,
        clip_similarity=result.clip_similarity,
        ssim_score=ssim_score,
    )

    db.add(violation)

    # -------------------------------
    # Create Propagation Edge
    # -------------------------------
    edge = PropagationEdge(
        id=str(uuid4()),
        source_asset_id=result.asset_id,
        violation_id=violation_id,
        platform=platform,
        leaked_by=leaked_by,
        watermark_id=attribution if watermark_verified else None,
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
        "leaked_by": leaked_by,
        "ssim_score": ssim_score,
        "detection_stage_results": stage_results,
        "details": result.details,
    }