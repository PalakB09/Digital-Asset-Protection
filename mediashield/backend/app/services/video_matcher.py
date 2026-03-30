"""
Video matcher — set-similarity matching for video assets.

Algorithm (from Milvus tutorial):
  For each candidate frame c_i:
    max_sim_i = max similarity between c_i and ANY frame of asset A
  video_similarity(candidate, A) = mean(max_sim_i) over all candidate frames

This gives a score in [0, 1]. Apply VIDEO_THRESHOLD to decide match.
"""

import logging
from sqlalchemy.orm import Session

from sqlalchemy import or_

from app.config import (
    VIDEO_THRESHOLD,
    VIDEO_HIGH_THRESHOLD,
    VIDEO_FRAMES,
    PHASH_THRESHOLD,
    CLIP_THRESHOLD,
    CLIP_HIGH_THRESHOLD,
    VIDEO_SHORT_CLIP_MAX_SEC,
    VIDEO_THRESHOLD_SHORT,
    CLIP_THRESHOLD_SHORT,
    VIDEO_HIGH_THRESHOLD_SHORT,
    CLIP_HIGH_THRESHOLD_SHORT,
)
from app.models.asset import Asset
from app.services.video_fingerprint import (
    compute_video_fingerprint,
    probe_video_metadata,
    choose_scan_frame_count,
)
from app.services import vector_store
from app.services.matcher import MatchResult
from app.services.fingerprint import hamming_distance

log = logging.getLogger(__name__)


def match_video(video_path: str, db: Session, n_frames: int | None = None) -> MatchResult:
    """
    Match a candidate video against all registered video assets.
    Returns MatchResult with best match found (or no match).

    If ``n_frames`` is None, chooses a denser sample count for short clips so
    small pirated cuts still match a long registered master.
    """
    total_frames, _fps, duration_sec = probe_video_metadata(video_path)
    if n_frames is None:
        n_frames = choose_scan_frame_count(total_frames, duration_sec, VIDEO_FRAMES)
    log.info(
        "Video scan: duration≈%.2fs, total_frames=%d, using %d sample frames",
        duration_sec,
        total_frames,
        n_frames,
    )

    # Step 1: Extract candidate frame embeddings (+ middle-frame pHash, same as registration)
    try:
        candidate_embeddings, candidate_phash, _ = compute_video_fingerprint(
            video_path, n_frames
        )
    except Exception as e:
        return MatchResult(matched=False, details=f"Frame extraction failed: {e}")

    if not candidate_embeddings:
        return MatchResult(matched=False, details="No frames extracted from video")

    log.info("Video scan: %d candidate frames extracted", len(candidate_embeddings))

    # Step 1b: pHash on middle frame — same tier as image scan (video assets only).
    # The CLIP-only path below does not use PHASH_THRESHOLD unless we check here.
    video_assets = (
        db.query(Asset)
        .filter(or_(Asset.asset_type == "video", Asset.frame_count.isnot(None)))
        .all()
    )
    best_phash_asset = None
    best_phash_dist = float("inf")
    for asset in video_assets:
        dist = hamming_distance(candidate_phash, asset.phash)
        if dist <= PHASH_THRESHOLD and dist < best_phash_dist:
            best_phash_dist = dist
            best_phash_asset = asset

    if best_phash_asset is not None:
        confidence = 1.0 - (best_phash_dist / 64.0)
        return MatchResult(
            matched=True,
            asset_id=best_phash_asset.id,
            asset_name=best_phash_asset.name,
            confidence=round(confidence, 4),
            match_tier="HIGH",
            match_type="phash",
            details=f"Video middle-frame pHash Hamming distance: {best_phash_dist}",
        )

    # Step 2: For each candidate frame, query top-k similar frames from DB
    # Build: asset_id -> list of per-candidate-frame max similarities
    asset_frame_max: dict = {}  # asset_id -> list[float] (one max per candidate frame)

    # Short clips: more indexed neighbors can matter when scores are noisy
    top_k = 30 if duration_sec >= 12.0 else 60
    for i, frame_emb in enumerate(candidate_embeddings):
        results = vector_store.query_video_frames(frame_emb, top_k=top_k)
        log.info("  Frame %d: got %d results from vector store", i, len(results))
        if results:
            log.info("    Top result: asset_id=%s similarity=%.4f",
                     results[0].get("asset_id"), results[0].get("similarity"))

        # Per this candidate frame: best similarity per asset
        frame_best: dict = {}  # asset_id -> best sim for this candidate frame
        for r in results:
            aid = r["asset_id"]
            sim = r["similarity"]
            if aid not in frame_best or sim > frame_best[aid]:
                frame_best[aid] = sim

        # Accumulate into asset_frame_max
        for aid, sim in frame_best.items():
            if aid not in asset_frame_max:
                asset_frame_max[aid] = []
            asset_frame_max[aid].append(sim)

    if not asset_frame_max:
        from app.services.vector_store import _get_video_collection
        count = _get_video_collection().count()
        log.warning("No results from video collection (collection has %d entries)", count)
        return MatchResult(matched=False, details=f"No video assets in index (collection count: {count})")

    # Step 3: Per asset — mean-of-max (set similarity) and best single-frame CLIP sim.
    # Match if mean ≥ VIDEO_THRESHOLD OR any frame ≥ CLIP_THRESHOLD (same idea as image L2).
    n_candidate = len(candidate_embeddings)
    best_asset_id = None
    best_effective = -1.0
    best_mean = 0.0
    best_max_frame = 0.0

    short = duration_sec > 0 and duration_sec <= VIDEO_SHORT_CLIP_MAX_SEC
    vt = VIDEO_THRESHOLD_SHORT if short else VIDEO_THRESHOLD
    ct = CLIP_THRESHOLD_SHORT if short else CLIP_THRESHOLD

    for aid, max_sims in asset_frame_max.items():
        if not max_sims:
            continue
        mean_score = sum(max_sims) / n_candidate
        max_frame = max(max_sims)
        # Frames with no hit in top-k are treated as 0 in the mean (numerator lacks them).
        effective = max(mean_score, max_frame)
        passes = mean_score >= vt or max_frame >= ct
        if passes and effective > best_effective:
            best_effective = effective
            best_asset_id = aid
            best_mean = mean_score
            best_max_frame = max_frame

    log.info(
        "Best match: asset_id=%s mean=%.4f max_frame=%.4f (video_thresh=%.2f clip_thresh=%.2f)",
        best_asset_id,
        best_mean,
        best_max_frame,
        vt,
        ct,
    )

    # Step 4: Threshold (already folded into passes above)
    if best_asset_id is None:
        all_means = [sum(s) / n_candidate for s in asset_frame_max.values() if s]
        all_maxes = [max(s) for s in asset_frame_max.values() if s]
        top_mean = max(all_means) if all_means else 0.0
        top_frame = max(all_maxes) if all_maxes else 0.0
        return MatchResult(
            matched=False,
            details=(
                f"No video pass: need mean-of-max ≥ {vt} or best frame ≥ {ct} "
                f"({'short-clip' if short else 'default'} thresholds). "
                f"(Best across assets: mean={top_mean:.4f}, single-frame={top_frame:.4f})"
            ),
        )

    best_score = max(best_mean, best_max_frame)

    asset = db.query(Asset).filter(Asset.id == best_asset_id).first()
    if not asset:
        return MatchResult(matched=False, details="Matched asset not found in DB")

    if short:
        high = best_mean >= VIDEO_HIGH_THRESHOLD_SHORT or best_max_frame >= CLIP_HIGH_THRESHOLD_SHORT
    else:
        high = best_mean >= VIDEO_HIGH_THRESHOLD or best_max_frame >= CLIP_HIGH_THRESHOLD
    tier = "HIGH" if high else "MEDIUM"
    return MatchResult(
        matched=True,
        asset_id=asset.id,
        asset_name=asset.name,
        confidence=round(best_score, 4),
        match_tier=tier,
        match_type="video_clip",
        details=(
            f"Video CLIP: mean-of-max={best_mean:.4f}, best frame={best_max_frame:.4f} "
            f"({n_candidate} query frames)"
        ),
    )
