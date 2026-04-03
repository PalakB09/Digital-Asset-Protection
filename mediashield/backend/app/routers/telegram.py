"""
Telegram (Telethon) discovery using per-asset Gemini keywords.

Requires a logged-in user session — see TELEGRAM_SETUP.md and scripts/telegram_login.py.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import telegram_configured
from app.database import SessionLocal
from app.models.asset import Asset
from app.services.telegram_pipeline import run_telegram_scrape_for_asset

router = APIRouter(prefix="/telegram", tags=["Telegram"])


class TelegramScrapeOptions(BaseModel):
    max_keywords: int = Field(5, ge=1, le=20)
    channels_per_keyword: int = Field(5, ge=1, le=15)
    messages_per_channel: int = Field(12, ge=1, le=50)


@router.get("/status")
async def telegram_status():
    """Whether API credentials are set and a session file exists."""
    from pathlib import Path

    from app.config import TELEGRAM_SESSION_PATH

    session_file = Path(str(TELEGRAM_SESSION_PATH) + ".session")
    return {
        "configured": telegram_configured(),
        "session_file_exists": session_file.is_file(),
        "hint": "Run: python scripts/telegram_login.py (from backend/) after setting .env",
    }


@router.post("/scrape/asset/{asset_id}")
async def scrape_telegram_for_asset(asset_id: str, body: TelegramScrapeOptions):
    """
    Use this asset's stored keywords to search Telegram (public channel discovery + in-channel search),
    download media, then run the same pHash/CLIP (or video) matching as manual scan.
    Respects slow pacing to reduce FloodWait risk.
    """
    if not telegram_configured():
        raise HTTPException(
            status_code=503,
            detail="Telegram not configured: set TELEGRAM_API_ID and TELEGRAM_API_HASH in backend/.env",
        )

    db = SessionLocal()
    try:
        if not db.query(Asset).filter(Asset.id == asset_id).first():
            raise HTTPException(status_code=404, detail="Asset not found")
    finally:
        db.close()

    result = await run_telegram_scrape_for_asset(
        asset_id,
        max_keywords=body.max_keywords,
        channels_per_keyword=body.channels_per_keyword,
        messages_per_channel=body.messages_per_channel,
    )

    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Telegram scrape failed"))

    return result
