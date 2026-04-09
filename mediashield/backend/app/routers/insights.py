"""
Insights router — AI-powered deep analysis for a given asset.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from collections import Counter

from app.database import get_db
from app.models.violation import Violation
from app.models.asset import Asset
from app.services import gemini_service

router = APIRouter(tags=["Insights"])


@router.get("/{asset_id}/insights")
async def get_asset_insights(asset_id: str, db: Session = Depends(get_db)):
    # 1. Verify Asset Exists
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # 2. Fetch all violations for this asset
    violations = db.query(Violation).filter(Violation.asset_id == asset_id).all()

    total_violations = len(violations)
    if total_violations == 0:
        return {"message": "No violations detected for this asset yet.", "total_violations": 0}

    # 3. Calculate Threat Metrics
    total_views = sum(v.views for v in violations if v.views)
    platforms = [v.platform for v in violations if v.platform]
    highest_threat_platform = max(set(platforms), key=platforms.count) if platforms else "unknown"

    # 4. Leaker Profiling (Who leaked it the most?)
    leakers = [v.leaked_by for v in violations if v.leaked_by]
    top_leaker = "Unknown"
    leaker_risk_level = "LOW"

    if leakers:
        counter = Counter(leakers)
        top_leaker, count = counter.most_common(1)[0]
        if count >= 3:
            leaker_risk_level = "CRITICAL"
        elif count == 2:
            leaker_risk_level = "MEDIUM"

    # 5. Alteration Analysis
    visually_altered = [v.ssim_score for v in violations if v.ssim_score is not None and v.ssim_score < 0.90]
    visually_altered_count = len(visually_altered)
    average_ssim = sum(visually_altered) / visually_altered_count if visually_altered_count > 0 else 1.0

    # 6. NLP Context & AI Summary (Send top 3 texts to Gemini to save tokens)
    texts_to_analyze = [v.scraped_text for v in violations if v.scraped_text and len(v.scraped_text) > 5]
    compiled_text = " | ".join(texts_to_analyze[:3])

    ai_data = await gemini_service.analyze_leak_context(
        scraped_text=compiled_text,
        platform=highest_threat_platform,
        views=total_views,
    )

    # 7. Construct Final Payload
    return {
        "asset_id": str(asset.id),
        "total_violations": total_violations,
        "threat_metrics": {
            "average_threat_score": ai_data.get("risk_score", 5.0),
            "highest_threat_platform": highest_threat_platform,
            "total_estimated_views": total_views,
        },
        "leaker_profile": {
            "top_leaker": top_leaker,
            "leaker_risk_level": leaker_risk_level,
        },
        "semantic_intent": {
            "primary_intent": ai_data.get("intent", "UNKNOWN"),
            "ai_summary": ai_data.get("ai_summary", ""),
        },
        "alteration_analysis": {
            "visually_altered_count": visually_altered_count,
            "average_ssim_score": round(average_ssim, 2),
        },
    }
