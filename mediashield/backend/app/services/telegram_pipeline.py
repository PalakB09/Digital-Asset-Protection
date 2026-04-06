"""
Orchestration: asset Gemini keywords → Telethon discovery → download → existing pHash/CLIP (or video) scan.

Uses a user Telegram session (not a bot). Rate-limited; see TELEGRAM_SETUP.md.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from uuid import uuid4

from PIL import Image

from app.config import TELEGRAM_MAX_DOWNLOAD_MB, VIOLATION_DIR
from app.database import SessionLocal
from app.models.asset import Asset, AssetRecipient
from app.models.violation import PropagationEdge, Violation
from app.models.telegram import MonitoredChannel
from app.services.alerts import fire_and_forget_broadcast
from app.services.scanner import scan_image
from app.services.watermark import extract_watermark_video
from app.services.telegram_scraper import (
    build_client,
    find_public_channels_by_keyword,
    search_messages_in_channel,
    download_message_media,
)
from app.services.video_matcher import match_video

log = logging.getLogger(__name__)

_VIDEO_SUFFIX = {".mp4", ".webm", ".mov", ".avi", ".mpeg", ".mkv"}


def _load_asset_keywords(asset_id: str) -> tuple[Asset | None, list[str]]:
    db = SessionLocal()
    try:
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            return None, []
        return asset, asset.keywords_list()
    finally:
        db.close()


def _violation_exists_for_url(source_url: str) -> bool:
    db = SessionLocal()
    try:
        return (
            db.query(Violation).filter(Violation.source_url == source_url).first() is not None
        )
    finally:
        db.close()


def _create_video_violation(filepath: str, filename: str, source_url: str, db) -> dict | None:
    """Run video matcher and persist violation if matched (same pattern as scan router)."""
    result = match_video(video_path=filepath, db=db, n_frames=None)
    if not result.matched:
        return None

    extracted = extract_watermark_video(filepath)
    watermark_verified = False
    attribution = None
    leaked_by = None

    if extracted:
        if extracted == result.asset_id:
            watermark_verified = True
            attribution = extracted
        else:
            recipient = db.query(AssetRecipient).filter(AssetRecipient.watermark_id == extracted).first()
            if recipient:
                watermark_verified = True
                attribution = extracted
                leaked_by = recipient.recipient_name

    match_tier = "VERIFIED" if watermark_verified else result.match_tier
    match_type = "watermark" if watermark_verified else result.match_type

    violation_id = str(uuid4())
    violation = Violation(
        id=violation_id,
        asset_id=result.asset_id,
        source_url=source_url,
        platform="telegram",
        confidence=result.confidence,
        match_tier=match_tier,
        match_type=match_type,
        image_path=filename,
        watermark_verified=watermark_verified,
        attribution=attribution,
        leaked_by=leaked_by,
    )
    db.add(violation)
    edge = PropagationEdge(
        id=str(uuid4()),
        source_asset_id=result.asset_id,
        violation_id=violation_id,
        platform="telegram",
        watermark_id=attribution if watermark_verified else None,
        leaked_by=leaked_by,
    )
    db.add(edge)
    db.commit()
    db.refresh(violation)
    return {
        "matched": True,
        "violation_id": violation.id,
        "asset_id": result.asset_id,
        "confidence": result.confidence,
        "match_tier": match_tier,
        "match_type": match_type,
        "watermark_verified": watermark_verified,
        "attribution": attribution,
        "leaked_by": leaked_by,
    }


async def run_telegram_scrape_for_asset(
    asset_id: str,
    *,
    max_keywords: int = 5,
    channels_per_keyword: int = 5,
    messages_per_channel: int = 12,
    delay_channel_sec: float = 2.0,
    delay_between_messages_sec: float = 1.0,
) -> dict:
    """
    For each stored keyword on the asset: find public channels, search messages, download media,
    run MediaShield image/video matching. Creates Violation rows when matched (dedup by source_url).
    """
    asset, keywords = _load_asset_keywords(asset_id)
    if not asset:
        return {"ok": False, "error": "asset not found", "results": []}
    if not keywords:
        return {
            "ok": False,
            "error": "no keywords on this asset — they are generated from the description at registration",
            "results": [],
        }

    max_bytes = max(1, TELEGRAM_MAX_DOWNLOAD_MB) * 1024 * 1024
    client = build_client()

    discovered: list[dict] = []
    violations_created = 0
    errors: list[str] = []

    async with client:
        if not await client.is_user_authorized():
            return {
                "ok": False,
                "error": "Telegram session not logged in. Run from backend folder: python scripts/telegram_login.py",
                "results": [],
            }

        for kw in keywords[:max_keywords]:
            try:
                channels = await find_public_channels_by_keyword(client, kw, limit=20)
            except Exception as e:
                errors.append(f"channel search {kw!r}: {e}")
                log.exception("[telegram] channel search failed")
                await asyncio.sleep(delay_channel_sec)
                continue

            discovered.append({"keyword": kw, "channels_found": len(channels)})
            await asyncio.sleep(delay_channel_sec)

            for ch in channels[:channels_per_keyword]:
                uname = ch.get("username") or ""
                if not uname:
                    continue
                try:
                    msgs = await search_messages_in_channel(
                        client, uname, kw, limit=messages_per_channel
                    )
                except Exception as e:
                    errors.append(f"search @{uname} {kw!r}: {e}")
                    await asyncio.sleep(delay_between_messages_sec)
                    continue

                await asyncio.sleep(1.0)

                for m in msgs:
                    url = m.get("url") or ""
                    if not url or _violation_exists_for_url(url):
                        await asyncio.sleep(delay_between_messages_sec)
                        continue

                    scan_id = uuid4().hex[:12]
                    dest_base = Path(VIOLATION_DIR) / f"tg_{scan_id}"
                    try:
                        path_str = await download_message_media(
                            client,
                            m["channel_username"],
                            m["message_id"],
                            dest_base,
                            max_bytes=max_bytes,
                        )
                    except Exception as e:
                        errors.append(f"download {url}: {e}")
                        await asyncio.sleep(delay_between_messages_sec)
                        continue

                    if not path_str or not os.path.isfile(path_str):
                        await asyncio.sleep(delay_between_messages_sec)
                        continue

                    suffix = Path(path_str).suffix.lower() or ".bin"
                    final_name = f"tg_{scan_id}{suffix}"
                    final_path = os.path.join(str(VIOLATION_DIR), final_name)
                    try:
                        if os.path.abspath(path_str) != os.path.abspath(final_path):
                            if os.path.exists(final_path):
                                os.remove(final_path)
                            os.replace(path_str, final_path)
                    except OSError:
                        final_path = path_str
                        final_name = os.path.basename(path_str)

                    db = SessionLocal()
                    try:
                        if suffix in _VIDEO_SUFFIX:
                            out = _create_video_violation(
                                final_path, final_name, url, db
                            )
                            if not out:
                                db.rollback()
                                try:
                                    os.remove(final_path)
                                except OSError:
                                    pass
                            else:
                                violations_created += 1
                                discovered.append(
                                    {
                                        "keyword": kw,
                                        "channel": uname,
                                        "url": url,
                                        "match": out,
                                    }
                                )
                                fire_and_forget_broadcast(
                                    {
                                        "type": "violation_alert",
                                        "violation": {
                                            "violation_id": out.get("violation_id"),
                                            "asset_id": out.get("asset_id"),
                                            "platform": "telegram",
                                            "source_url": url,
                                        },
                                    }
                                )
                        else:
                            try:
                                image = Image.open(final_path).convert("RGB")
                            except Exception:
                                try:
                                    os.remove(final_path)
                                except OSError:
                                    pass
                                await asyncio.sleep(delay_between_messages_sec)
                                continue

                            out = scan_image(
                                image,
                                db,
                                source_url=url,
                                platform="telegram",
                                image_path=final_name,
                            )
                            if out.get("matched"):
                                violations_created += 1
                                discovered.append(
                                    {
                                        "keyword": kw,
                                        "channel": uname,
                                        "url": url,
                                        "match": {
                                            "violation_id": out.get("violation_id"),
                                            "asset_id": out.get("asset_id"),
                                            "confidence": out.get("confidence"),
                                        },
                                    }
                                )
                                fire_and_forget_broadcast(
                                    {
                                        "type": "violation_alert",
                                        "violation": {
                                            "violation_id": out.get("violation_id"),
                                            "asset_id": out.get("asset_id"),
                                            "platform": "telegram",
                                            "source_url": url,
                                        },
                                    }
                                )
                            else:
                                try:
                                    os.remove(final_path)
                                except OSError:
                                    pass
                            # Wait, auto-inject this channel into MonitoredChannel since we confirmed a leak!
                            if out.get("matched") or (suffix in _VIDEO_SUFFIX and out):
                                existing = db.query(MonitoredChannel).filter(MonitoredChannel.channel_username == uname).first()
                                if not existing:
                                    mc = MonitoredChannel(
                                        id=str(uuid4()),
                                        channel_username=uname,
                                        added_via_keyword=kw,
                                        is_active=True
                                    )
                                    db.add(mc)
                                    db.commit()
                    finally:
                        db.close()

                    await asyncio.sleep(delay_between_messages_sec)

    return {
        "ok": True,
        "asset_id": asset_id,
        "asset_name": asset.name,
        "keywords_used": keywords[:max_keywords],
        "violations_created": violations_created,
        "discovered": discovered,
        "errors": errors,
    }
