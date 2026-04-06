import asyncio
import os
import logging
from pathlib import Path
from uuid import uuid4

# Setup basic logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] telegram_worker: %(message)s")
log = logging.getLogger("telegram_worker")

# Set up paths so we can import app modules properly
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from telethon import TelegramClient, events
from telethon.tl.types import Channel

from app.config import TELEGRAM_MAX_DOWNLOAD_MB, VIOLATION_DIR, TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION_PATH
from app.database import SessionLocal
from app.models.telegram import MonitoredChannel
from PIL import Image
from app.services.scanner import scan_image
from app.services.telegram_pipeline import _create_video_violation, _VIDEO_SUFFIX
from app.services.alerts import fire_and_forget_broadcast

monitored_usernames = set()

async def sync_monitored_channels():
    """Background task to sync the monitored_usernames set with the SQLite database."""
    global monitored_usernames
    while True:
        db = SessionLocal()
        try:
            channels = db.query(MonitoredChannel).filter(MonitoredChannel.is_active == True).all()
            new_set = {c.channel_username.lower().replace("@", "") for c in channels}
            
            if new_set != monitored_usernames:
                log.info(f"Updated monitored channels list. Tracking {len(new_set)} channels.")
                monitored_usernames = new_set
        except Exception as e:
            log.error(f"Failed to sync monitored channels: {e}")
        finally:
            db.close()
        
        await asyncio.sleep(300)  # Check every 60 seconds

async def handle_new_message(event):
    """Event handler for new Telegram messages."""
    global monitored_usernames
    
    chat = await event.get_chat()
    if not isinstance(chat, Channel):
        return
        
    username = getattr(chat, "username", None)
    if not username:
        return
        
    username = username.lower()
    
    # Check if we are monitoring this channel
    if username not in monitored_usernames:
        return
        
    if not event.media:
        return
        
    log.info(f"[NEW MESSAGE INTERCEPTED] Channel: @{username} | ID: {event.id}")
    
    # It has media, let's download it
    doc = getattr(event.media, "document", None)
    max_bytes = max(1, TELEGRAM_MAX_DOWNLOAD_MB) * 1024 * 1024
    if doc and getattr(doc, "size", 0) and doc.size > max_bytes:
        log.info(f"Skipping large file from @{username}: {doc.size} bytes")
        return
        
    scan_id = uuid4().hex[:12]
    url = f"https://t.me/{username}/{event.id}"
    
    # Download
    temp_dest = Path(VIOLATION_DIR) / f"tg_rt_{scan_id}"
    try:
        path = await event.client.download_media(event.message, file=str(temp_dest))
        if not path:
            return
        path_str = str(path)
    except Exception as e:
        log.error(f"Failed to download media from @{username}: {e}")
        return
        
    suffix = Path(path_str).suffix.lower() or ".bin"
    final_name = f"tg_rt_{scan_id}{suffix}"
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
            log.info(f"Running video detection on {final_name}")
            out = _create_video_violation(final_path, final_name, url, db)
            if not out:
                db.rollback()
                try:
                    os.remove(final_path)
                except OSError:
                    pass
            else:
                log.info(f"🚨 VIDEO LEAK MATCHED! Asset: {out.get('asset_id')}")
                fire_and_forget_broadcast(
                    {
                        "type": "violation_alert",
                        "violation": {
                            "violation_id": out.get("violation_id"),
                            "asset_id": out.get("asset_id"),
                            "platform": "telegram (real-time)",
                            "source_url": url,
                        },
                    }
                )
        else:
            log.info(f"Running image detection on {final_name}")
            try:
                image = Image.open(final_path).convert("RGB")
                out = scan_image(image, db, source_url=url, platform="telegram", image_path=final_name)
                if out.get("matched"):
                    log.info(f"🚨 IMAGE LEAK MATCHED! Asset: {out.get('asset_id')}")
                    fire_and_forget_broadcast(
                        {
                            "type": "violation_alert",
                            "violation": {
                                "violation_id": out.get("violation_id"),
                                "asset_id": out.get("asset_id"),
                                "platform": "telegram (real-time)",
                                "source_url": url,
                            },
                        }
                    )
                else:
                    try:
                        os.remove(final_path)
                    except OSError:
                        pass
            except Exception as e:
                log.error(f"Failed to process image: {e}")
                try:
                    os.remove(final_path)
                except OSError:
                    pass
    finally:
        db.close()


async def main():
    log.info("Starting Telegram Real-Time Listening Worker...")
    
    # Start sync task
    asyncio.create_task(sync_monitored_channels())
    
    client = TelegramClient(str(TELEGRAM_SESSION_PATH), TELEGRAM_API_ID, TELEGRAM_API_HASH)
    await client.start()
    
    if not await client.is_user_authorized():
        log.error("Telegram session not logged in. Run: python scripts/telegram_login.py")
        return
        
    log.info("Telegram Client Connected.")
    
    # Register the event listener (listen to all new messages, filter inside the handler)
    client.add_event_handler(handle_new_message, events.NewMessage())
    
    log.info("Listening for incoming messages... (Press Ctrl+C to stop)")
    await client.run_until_disconnected()

if __name__ == "__main__":
    asyncio.run(main())
