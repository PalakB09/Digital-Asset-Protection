"""
Monitoring router for polling-based discovery workers.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.violation import Violation

from app.services.monitoring import PostEvent, enqueue_post_event, queue_stats

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


class PostEventIn(BaseModel):
    post_id: str = Field(..., min_length=1)
    url: str = Field(..., min_length=1)
    media_urls: list[str] = Field(default_factory=list)
    timestamp: str = Field(..., min_length=1)
    platform: str = Field(..., min_length=1)
    scraped_text: str = Field(default="")
    views: int = Field(default=0)


@router.post("/events")
async def ingest_post_event(payload: PostEventIn):
    if not payload.media_urls:
        raise HTTPException(status_code=400, detail="media_urls is required")

    result = await enqueue_post_event(
        PostEvent(
            post_id=payload.post_id,
            url=payload.url,
            media_urls=payload.media_urls,
            timestamp=payload.timestamp,
            platform=payload.platform,
            scraped_text=payload.scraped_text,
            views=payload.views,
        )
    )
    return result


@router.get("/queue")
async def get_queue_stats():
    return queue_stats()

@router.get("/feed")
async def get_monitoring_feed(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    """Fetch the latest global detected violations across all platforms to display in the live feed."""
    violations = db.query(Violation).order_by(Violation.created_at.desc()).offset(offset).limit(limit).all()
    
    events = []
    for v in violations:
        events.append({
            "id": v.id,
            "platform": v.platform,
            "url": v.source_url,
            "timestamp": v.created_at.isoformat() if v.created_at else "",
            "status": "processed",
            "image_url": f"/api/violations/{v.id}/image" if v.image_path else ""  
        })
    return events


@router.get("/pipeline-status")
async def get_pipeline_status(db: Session = Depends(get_db)):
    """Per-platform pipeline status: running/completed jobs and violation counts."""
    from app.services.job_queue import get_queue
    from app.models.telegram import MonitoredChannel

    queue = get_queue()
    jobs = queue.list_jobs(limit=200)

    # Count jobs per platform
    platform_map = {
        "twitter_scrape_asset": "twitter",
        "youtube_scrape_asset": "youtube",
        "google_scrape_asset": "google",
        "telegram_discover_asset": "telegram",
    }

    status: dict = {
        "twitter": {"running": 0, "completed": 0, "failed": 0, "total_violations": 0},
        "youtube": {"running": 0, "completed": 0, "failed": 0, "total_violations": 0},
        "google": {"running": 0, "completed": 0, "failed": 0, "total_violations": 0},
        "telegram": {"running": 0, "completed": 0, "failed": 0, "total_violations": 0, "channels": 0},
    }

    for j in jobs:
        platform = platform_map.get(j.get("job_type", ""), None)
        if not platform:
            continue
        s = j.get("status", "")
        if s in ("pending", "processing"):
            status[platform]["running"] += 1
        elif s == "done":
            status[platform]["completed"] += 1
        elif s == "failed":
            status[platform]["failed"] += 1

    # Violation counts per platform
    from sqlalchemy import func
    platform_violations = (
        db.query(Violation.platform, func.count(Violation.id))
        .group_by(Violation.platform)
        .all()
    )
    for plat, cnt in platform_violations:
        p_key = plat.lower() if plat else "unknown"
        if p_key == "web":
            p_key = "google"
        if p_key in status:
            status[p_key]["total_violations"] = cnt

    # Telegram channels
    try:
        status["telegram"]["channels"] = db.query(MonitoredChannel).count()
    except Exception:
        pass

    return status
