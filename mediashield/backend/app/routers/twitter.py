"""
Twitter/X router — queue a background scrape for a registered asset.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List

from app.database import get_db
from app.models.asset import Asset
from app.services.job_queue import Job, get_queue
from sqlalchemy.orm import Session

router = APIRouter(prefix="/twitter", tags=["Twitter"])


class TwitterScrapeRequest(BaseModel):
    max_keywords: int = Field(default=5, ge=1, le=20)
    posts_per_keyword: int = Field(default=20, ge=1, le=50)
    media_per_post: int = Field(default=3, ge=1, le=10)
    force_post_urls: List[str] = Field(default_factory=list, max_length=20)


@router.post("/scrape/{asset_id}")
async def queue_twitter_scrape(asset_id: str, payload: TwitterScrapeRequest, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    job = Job(
        job_type="twitter_scrape_asset",
        payload={
            "asset_id": asset_id,
            "max_keywords": payload.max_keywords,
            "posts_per_keyword": payload.posts_per_keyword,
            "media_per_post": payload.media_per_post,
            "force_post_urls": payload.force_post_urls,
        },
    )
    queue = get_queue()
    await queue.push(job)
    return {
        "status": "queued",
        "job_id": job.id,
        "asset_id": asset_id,
        "asset_name": asset.name,
    }