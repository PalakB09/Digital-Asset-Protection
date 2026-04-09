"""
Monitoring router for polling-based discovery workers.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

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
