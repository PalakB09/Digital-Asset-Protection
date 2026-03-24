"""
Matcher service — tiered matching pipeline.

L1: pHash (Hamming distance ≤ PHASH_THRESHOLD) → HIGH confidence
L2: CLIP embedding (cosine similarity ≥ CLIP_THRESHOLD) → MEDIUM/HIGH confidence
"""

from dataclasses import dataclass
from PIL import Image
from sqlalchemy.orm import Session

from app.config import PHASH_THRESHOLD, CLIP_THRESHOLD, CLIP_HIGH_THRESHOLD
from app.models.asset import Asset
from app.services.fingerprint import compute_phash, compute_embedding, hamming_distance
from app.services import vector_store


@dataclass
class MatchResult:
    matched: bool
    asset_id: str | None = None
    asset_name: str | None = None
    confidence: float = 0.0
    match_tier: str = "NONE"     # HIGH, MEDIUM, NONE
    match_type: str = "none"     # phash, clip, none
    details: str = ""


def match_image(image: Image.Image, db: Session) -> MatchResult:
    """
    Run the tiered matching pipeline on a candidate image.
    
    Returns a MatchResult with the best match found (or no match).
    """

    # ------------------------------------------------------------------
    # L1: pHash matching
    # ------------------------------------------------------------------
    candidate_phash = compute_phash(image)

    # Query all assets and compare pHash
    assets = db.query(Asset).all()
    best_phash_match = None
    best_phash_distance = float("inf")

    for asset in assets:
        dist = hamming_distance(candidate_phash, asset.phash)
        if dist <= PHASH_THRESHOLD and dist < best_phash_distance:
            best_phash_distance = dist
            best_phash_match = asset

    if best_phash_match is not None:
        # Confidence: inverse of distance, scaled to 0-1
        confidence = 1.0 - (best_phash_distance / 64.0)
        return MatchResult(
            matched=True,
            asset_id=best_phash_match.id,
            asset_name=best_phash_match.name,
            confidence=round(confidence, 4),
            match_tier="HIGH",
            match_type="phash",
            details=f"pHash Hamming distance: {best_phash_distance}",
        )

    # ------------------------------------------------------------------
    # L2: CLIP embedding matching
    # ------------------------------------------------------------------
    candidate_embedding = compute_embedding(image)
    similar = vector_store.query_similar(candidate_embedding, top_k=5)

    if similar:
        best = similar[0]
        similarity = best["similarity"]

        if similarity >= CLIP_THRESHOLD:
            # Look up the asset
            asset = db.query(Asset).filter(Asset.id == best["id"]).first()
            if asset:
                tier = "HIGH" if similarity >= CLIP_HIGH_THRESHOLD else "MEDIUM"
                return MatchResult(
                    matched=True,
                    asset_id=asset.id,
                    asset_name=asset.name,
                    confidence=round(similarity, 4),
                    match_tier=tier,
                    match_type="clip",
                    details=f"CLIP cosine similarity: {similarity:.4f}",
                )

    # ------------------------------------------------------------------
    # No match found
    # ------------------------------------------------------------------
    return MatchResult(matched=False, details="No match found in any tier")
