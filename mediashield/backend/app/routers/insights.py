"""
Insights router — AI-powered deep analysis for a given asset.

Provides the /assets/{asset_id}/insights endpoint with comprehensive
threat intelligence derived entirely from existing PostgreSQL/SQLite data.
No external enrichment APIs required.
"""

import json
import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.asset import Asset, AssetRecipient, AssetDistribution
from app.models.violation import Violation, PropagationEdge
from app.services import gemini_service

router = APIRouter(tags=["Insights"])
log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _safe_avg(values: list) -> float:
    return round(sum(values) / len(values), 4) if values else 0.0


def _velocity(violations: list[Violation]) -> dict:
    """
    Calculate how fast violations are accumulating.

    Returns:
        - first_seen: ISO timestamp of earliest violation
        - last_seen:  ISO timestamp of most recent violation
        - days_active: span in days from first to last
        - violations_per_day: average rate over active window
        - last_7d_count: violations in the last 7 calendar days
        - last_30d_count: violations in the last 30 calendar days
        - acceleration: "ACCELERATING" | "STABLE" | "DECLINING" | "UNKNOWN"
          Compares last-7d rate vs the prior 7-day window.
    """
    if not violations:
        return {
            "first_seen": None,
            "last_seen": None,
            "days_active": 0,
            "violations_per_day": 0.0,
            "last_7d_count": 0,
            "last_30d_count": 0,
            "acceleration": "UNKNOWN",
        }

    now = datetime.now(timezone.utc)
    timestamps = sorted(
        [v.created_at.replace(tzinfo=timezone.utc) if v.created_at.tzinfo is None
         else v.created_at for v in violations if v.created_at]
    )

    first = timestamps[0]
    last = timestamps[-1]
    days_span = max((last - first).days, 1)

    cutoff_7d = now - timedelta(days=7)
    cutoff_14d = now - timedelta(days=14)
    cutoff_30d = now - timedelta(days=30)

    last_7d = sum(1 for t in timestamps if t >= cutoff_7d)
    prev_7d = sum(1 for t in timestamps if cutoff_14d <= t < cutoff_7d)
    last_30d = sum(1 for t in timestamps if t >= cutoff_30d)

    if last_7d > prev_7d * 1.25:
        acceleration = "ACCELERATING"
    elif last_7d < prev_7d * 0.75 and prev_7d > 0:
        acceleration = "DECLINING"
    elif prev_7d == 0 and last_7d > 0:
        acceleration = "ACCELERATING"
    else:
        acceleration = "STABLE"

    return {
        "first_seen": first.isoformat(),
        "last_seen": last.isoformat(),
        "days_active": days_span,
        "violations_per_day": round(len(violations) / days_span, 2),
        "last_7d_count": last_7d,
        "last_30d_count": last_30d,
        "acceleration": acceleration,
    }


def _platform_breakdown(violations: list[Violation]) -> list[dict]:
    """
    Per-platform stats: count, views, likes, avg confidence, watermark_verified rate.
    Sorted by total views descending.
    """
    platform_data: dict[str, dict] = defaultdict(lambda: {
        "count": 0, "views": 0, "likes": 0,
        "confidences": [], "watermark_verified": 0,
        "high_tier": 0, "match_types": Counter(),
    })

    for v in violations:
        p = (v.platform or "unknown").lower()
        d = platform_data[p]
        d["count"] += 1
        d["views"] += v.views or 0
        d["likes"] += v.likes or 0
        if v.confidence is not None:
            d["confidences"].append(v.confidence)
        if v.watermark_verified:
            d["watermark_verified"] += 1
        if v.match_tier == "HIGH":
            d["high_tier"] += 1
        if v.match_type:
            d["match_types"][v.match_type] += 1

    result = []
    for platform, d in platform_data.items():
        result.append({
            "platform": platform,
            "violation_count": d["count"],
            "total_views": d["views"],
            "total_likes": d["likes"],
            "avg_confidence": _safe_avg(d["confidences"]),
            "watermark_verified_count": d["watermark_verified"],
            "high_tier_count": d["high_tier"],
            "dominant_match_type": d["match_types"].most_common(1)[0][0]
                if d["match_types"] else "unknown",
        })

    return sorted(result, key=lambda x: x["total_views"], reverse=True)


def _match_quality_profile(violations: list[Violation]) -> dict:
    """
    Aggregated signal quality across all violations.

    Covers:
    - phash_distance distribution (buckets)
    - clip_similarity distribution
    - watermark verification rate
    - match_tier counts (HIGH / MEDIUM)
    - match_type counts (phash / clip / watermark / hybrid)
    - ssim (visual alteration) distribution
    - overall_confidence_avg across all violations
    """
    phash_distances = [v.phash_distance for v in violations if v.phash_distance is not None]
    clip_sims = [v.clip_similarity for v in violations if v.clip_similarity is not None]
    ssim_scores = [v.ssim_score for v in violations if v.ssim_score is not None]
    confidences = [v.confidence for v in violations if v.confidence is not None]
    final_confidences = [
        v.confidence_score for v in violations if v.confidence_score is not None
    ]

    tier_counts = Counter(v.match_tier for v in violations if v.match_tier)
    type_counts = Counter(v.match_type for v in violations if v.match_type)
    verified_count = sum(1 for v in violations if v.watermark_verified)

    # pHash bucket: 0 = identical, 1-4 = very similar, 5-8 = similar
    phash_identical = sum(1 for d in phash_distances if d == 0)
    phash_very_similar = sum(1 for d in phash_distances if 1 <= d <= 4)
    phash_similar = sum(1 for d in phash_distances if 5 <= d <= 8)

    return {
        "overall_confidence_avg": _safe_avg(confidences),
        "reranked_confidence_avg": _safe_avg(final_confidences),
        "watermark_verified_count": verified_count,
        "watermark_verified_pct": round(verified_count / len(violations) * 100, 1)
            if violations else 0.0,
        "match_tier_counts": dict(tier_counts),
        "match_type_counts": dict(type_counts),
        "phash": {
            "available": len(phash_distances),
            "avg_distance": _safe_avg(phash_distances),
            "identical_count": phash_identical,
            "very_similar_count": phash_very_similar,
            "similar_count": phash_similar,
        },
        "clip_similarity": {
            "available": len(clip_sims),
            "avg": _safe_avg(clip_sims),
            "above_0_92_count": sum(1 for s in clip_sims if s >= 0.92),
        },
        "ssim_alteration": {
            "available": len(ssim_scores),
            "avg_ssim": _safe_avg(ssim_scores),
            "heavily_altered_count": sum(1 for s in ssim_scores if s < 0.80),
            "mildly_altered_count": sum(1 for s in ssim_scores if 0.80 <= s < 0.90),
            "near_identical_count": sum(1 for s in ssim_scores if s >= 0.90),
        },
    }


def _leaker_profile(violations: list[Violation], recipients: list) -> dict:
    """
    Leaker risk profiling.

    Cross-references violation.leaked_by with registered recipients
    (AssetRecipient) so known internal distributors are flagged.
    """
    leakers = [v.leaked_by for v in violations if v.leaked_by and v.leaked_by.strip()]
    if not leakers:
        return {
            "top_leaker": None,
            "top_leaker_count": 0,
            "unique_leaker_count": 0,
            "leaker_risk_level": "UNKNOWN",
            "is_registered_recipient": False,
            "all_leakers": [],
        }

    counter = Counter(leakers)
    top_leaker, top_count = counter.most_common(1)[0]

    if top_count >= 5:
        risk = "CRITICAL"
    elif top_count >= 3:
        risk = "HIGH"
    elif top_count == 2:
        risk = "MEDIUM"
    else:
        risk = "LOW"

    # Check if top leaker matches a known recipient
    recipient_identifiers = {r.recipient_identifier.lower() for r in recipients}
    recipient_names = {r.recipient_name.lower() for r in recipients}
    is_recipient = (
        top_leaker.lower() in recipient_identifiers
        or top_leaker.lower() in recipient_names
    )

    return {
        "top_leaker": top_leaker,
        "top_leaker_count": top_count,
        "unique_leaker_count": len(counter),
        "leaker_risk_level": risk,
        "is_registered_recipient": is_recipient,
        "all_leakers": [
            {"leaker": name, "count": cnt}
            for name, cnt in counter.most_common(10)
        ],
    }


def _watermark_forensics(violations: list[Violation], recipients: list,
                          distributions: list) -> dict:
    """
    Watermark attribution forensics.

    - How many violations have a watermark attribution string
    - How many match a known distribution (watermark_id cross-ref)
    - List of attributed recipients with violation counts
    """
    attributed = [v for v in violations if v.attribution and v.attribution.strip()]
    wm_ids = {d.watermark_id: d for d in distributions}
    recipient_map = {r.id: r for r in recipients}

    traced: list[dict] = []
    for v in attributed:
        # Try to match attribution to a known watermark_id
        dist = wm_ids.get(v.attribution)
        if dist:
            recip = recipient_map.get(dist.recipient_id)
            traced.append({
                "violation_id": v.id,
                "watermark_id": v.attribution,
                "recipient_name": recip.recipient_name if recip else "Unknown",
                "recipient_identifier": recip.recipient_identifier if recip else None,
                "platform": v.platform,
                "source_url": v.source_url,
                "detected_at": v.created_at.isoformat() if v.created_at else None,
            })

    return {
        "attributed_violation_count": len(attributed),
        "traced_to_recipient_count": len(traced),
        "attribution_rate_pct": round(len(attributed) / len(violations) * 100, 1)
            if violations else 0.0,
        "traced_recipients": traced[:20],  # cap at 20 for payload size
    }


def _engagement_risk(violations: list[Violation]) -> dict:
    """
    Engagement-based risk signal.

    High views/likes = broader exposure = higher urgency for takedown.
    """
    views_list = [v.views or 0 for v in violations]
    likes_list = [v.likes or 0 for v in violations]

    total_views = sum(views_list)
    total_likes = sum(likes_list)
    max_views = max(views_list) if views_list else 0
    max_likes = max(likes_list) if likes_list else 0

    # Find the single highest-exposure violation
    top_violation = max(violations, key=lambda v: (v.views or 0), default=None)

    # Engagement risk tier
    if total_views >= 1_000_000:
        exposure_tier = "VIRAL"
    elif total_views >= 100_000:
        exposure_tier = "HIGH"
    elif total_views >= 10_000:
        exposure_tier = "MODERATE"
    elif total_views > 0:
        exposure_tier = "LOW"
    else:
        exposure_tier = "UNKNOWN"

    return {
        "total_estimated_views": total_views,
        "total_estimated_likes": total_likes,
        "max_single_violation_views": max_views,
        "max_single_violation_likes": max_likes,
        "avg_views_per_violation": round(total_views / len(violations), 1)
            if violations else 0.0,
        "exposure_tier": exposure_tier,
        "top_violation_id": top_violation.id if top_violation else None,
        "top_violation_url": top_violation.source_url if top_violation else None,
        "top_violation_platform": top_violation.platform if top_violation else None,
    }


def _media_type_breakdown(violations: list[Violation]) -> dict:
    """
    Image vs video split, plus processing status health check.
    """
    type_counts = Counter(v.match_type or "image" for v in violations)
    status_counts = Counter(v.processing_status or "done" for v in violations)

    return {
        "media_type_counts": dict(type_counts),
        "processing_status_counts": dict(status_counts),
        "failed_count": status_counts.get("failed", 0),
        "pending_count": status_counts.get("pending", 0),
    }


def _detection_stage_summary(violations: list[Violation]) -> dict:
    """
    Parse detection_stage_results JSON blobs (stored per-violation) and
    aggregate which detection stages fired most often.

    detection_stage_results is a JSON string like:
      {"phash": true, "clip": true, "watermark": false}
    """
    stage_hits: Counter = Counter()
    parseable = 0

    for v in violations:
        if not v.detection_stage_results:
            continue
        try:
            stages = json.loads(v.detection_stage_results)
            parseable += 1
            for stage, hit in stages.items():
                if hit:
                    stage_hits[stage] += 1
        except Exception:
            pass

    return {
        "violations_with_stage_data": parseable,
        "stage_hit_counts": dict(stage_hits),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main endpoint
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{asset_id}/insights")
async def get_asset_insights(asset_id: str, db: Session = Depends(get_db)):
    """
    Comprehensive threat intelligence dashboard for an asset.

    Aggregates all signals from:
    - Violation records (confidence, pHash, CLIP, SSIM, watermark, engagement)
    - Asset recipients & distributions (watermark attribution tracing)
    - Propagation edges (graph topology)
    - Gemini AI (intent classification + risk summary)

    All computation is local — no external API calls except Gemini.
    """
    # ── 1. Verify asset exists ─────────────────────────────────────────────────
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # ── 2. Fetch all violations ────────────────────────────────────────────────
    violations: list[Violation] = (
        db.query(Violation)
        .filter(Violation.asset_id == asset_id)
        .order_by(Violation.created_at.asc())
        .all()
    )

    total_violations = len(violations)
    if total_violations == 0:
        return {
            "asset_id": str(asset.id),
            "asset_name": asset.name,
            "asset_type": asset.asset_type,
            "total_violations": 0,
            "message": "No violations detected for this asset yet.",
        }

    # ── 3. Fetch recipients & distributions for watermark tracing ─────────────
    recipients = (
        db.query(AssetRecipient)
        .filter(AssetRecipient.asset_id == asset_id)
        .all()
    )
    distributions = (
        db.query(AssetDistribution)
        .filter(AssetDistribution.asset_id == asset_id)
        .all()
    )

    # ── 4. Fetch propagation graph stats ──────────────────────────────────────
    prop_edges = (
        db.query(PropagationEdge)
        .filter(PropagationEdge.source_asset_id == asset_id)
        .all()
    )
    unique_channels = len({e.platform for e in prop_edges if e.platform})

    # ── 5. Compute all insight modules ────────────────────────────────────────
    velocity = _velocity(violations)
    platform_breakdown = _platform_breakdown(violations)
    match_quality = _match_quality_profile(violations)
    leaker = _leaker_profile(violations, recipients)
    wm_forensics = _watermark_forensics(violations, recipients, distributions)
    engagement = _engagement_risk(violations)
    media_info = _media_type_breakdown(violations)
    stage_summary = _detection_stage_summary(violations)

    # ── 6. Highest-threat platform ─────────────────────────────────────────────
    highest_threat_platform = (
        platform_breakdown[0]["platform"] if platform_breakdown else "unknown"
    )

    # ── 7. Gemini AI — send top-3 scraped texts only ──────────────────────────
    texts = [
        v.scraped_text for v in violations
        if v.scraped_text and len(v.scraped_text.strip()) > 5
    ]
    compiled_text = " | ".join(texts[:3]) if texts else ""

    ai_data = await gemini_service.analyze_leak_context(
        scraped_text=compiled_text,
        platform=highest_threat_platform,
        views=engagement["total_estimated_views"],
    )

    # ── 8. Composite threat score ──────────────────────────────────────────────
    # Weighted blend: Gemini risk (40%) + engagement tier (30%) + match quality (30%)
    gemini_risk = float(ai_data.get("risk_score", 5.0))
    exposure_score_map = {
        "VIRAL": 10.0, "HIGH": 8.0, "MODERATE": 6.0, "LOW": 3.0, "UNKNOWN": 1.0
    }
    exposure_score = exposure_score_map.get(engagement["exposure_tier"], 5.0)
    confidence_score = match_quality["overall_confidence_avg"] * 10.0
    composite_threat_score = round(
        gemini_risk * 0.4 + exposure_score * 0.3 + confidence_score * 0.3, 2
    )

    # ── 9. Construct response ──────────────────────────────────────────────────
    return {
        # ── Asset summary
        "asset_id": str(asset.id),
        "asset_name": asset.name,
        "asset_type": asset.asset_type or "image",
        "asset_keywords": asset.keywords_list(),
        "registered_recipients": len(recipients),
        "total_distributions": len(distributions),
        "total_violations": total_violations,
        "propagation_channels": unique_channels,

        # ── Composite score (0–10)
        "composite_threat_score": min(composite_threat_score, 10.0),

        # ── Velocity / temporal
        "velocity": velocity,

        # ── Engagement / exposure
        "engagement_risk": engagement,

        # ── Platform breakdown
        "platform_breakdown": platform_breakdown,
        "highest_threat_platform": highest_threat_platform,

        # ── Match quality & signal analysis
        "match_quality": match_quality,

        # ── Detection stage pipeline stats
        "detection_stages": stage_summary,

        # ── Watermark forensics
        "watermark_forensics": wm_forensics,

        # ── Leaker profiling
        "leaker_profile": leaker,

        # ── Media type and processing health
        "media_info": media_info,

        # ── Gemini AI
        "ai_analysis": {
            "primary_intent": ai_data.get("intent", "UNKNOWN"),
            "risk_score": gemini_risk,
            "ai_summary": ai_data.get("ai_summary", ""),
        },
    }