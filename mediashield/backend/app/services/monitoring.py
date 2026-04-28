"""
Near real-time monitoring pipeline primitives.

Implements:
- Post event schema adapters
- Dedup cache (in-memory, TTL)
- Async ingestion queue
- Background worker that runs image matching
"""

import asyncio
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request
from collections import deque
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from PIL import Image

from app.config import VIOLATION_DIR
from app.database import SessionLocal
from app.models.violation import Violation, PropagationEdge
from app.services.alerts import fire_and_forget_broadcast
from app.services.matcher import match_image
from app.services.watermark import extract_watermark


@dataclass
class PostEvent:
    post_id: str
    url: str
    media_urls: list[str]
    timestamp: str
    platform: str
    scraped_text: str = ""
    views: int = 0


class DedupCache:
    def __init__(self, ttl_seconds: int = 3600, max_items: int = 10000):
        self.ttl_seconds = ttl_seconds
        self.max_items = max_items
        self._store: dict[str, float] = {}
        self._order: deque[str] = deque()

    def seen_or_add(self, key: str) -> bool:
        self._evict_expired()
        if key in self._store:
            return True

        self._store[key] = time.time()
        self._order.append(key)
        self._enforce_size()
        return False

    def size(self) -> int:
        self._evict_expired()
        return len(self._store)

    def _evict_expired(self):
        now = time.time()
        while self._order:
            k = self._order[0]
            ts = self._store.get(k)
            if ts is None:
                self._order.popleft()
                continue
            if now - ts <= self.ttl_seconds:
                break
            self._order.popleft()
            self._store.pop(k, None)

    def _enforce_size(self):
        while len(self._store) > self.max_items and self._order:
            oldest = self._order.popleft()
            self._store.pop(oldest, None)


_event_queue: asyncio.Queue[PostEvent] = asyncio.Queue(maxsize=500)
dedup_cache = DedupCache()


async def enqueue_post_event(event: PostEvent) -> dict[str, Any]:
    if dedup_cache.seen_or_add(event.post_id):
        return {"accepted": False, "reason": "duplicate"}

    await _event_queue.put(event)
    return {"accepted": True, "queue_size": _event_queue.qsize()}


def queue_stats() -> dict[str, int]:
    return {
        "queue_size": _event_queue.qsize(),
        "dedup_cache_size": dedup_cache.size(),
    }


async def monitoring_worker():
    while True:
        event = await _event_queue.get()
        try:
            process_post_event(event)
        except Exception:
            # Keep worker alive; errors can be inspected in logs.
            pass
        finally:
            _event_queue.task_done()


def process_post_event(event: PostEvent):
    """CPU-friendly media processing for MVP: image URLs first."""
    db = SessionLocal()
    try:
        for media_url in event.media_urls:
            _process_single_media(db, event, media_url)
    finally:
        db.close()


def _process_single_media(db, event: PostEvent, media_url: str):
    media_kind, local_path = _download_media(media_url)
    if not local_path:
        return

    result = None
    if media_kind == "image":
        result = _match_image_path(db, local_path)
        if not result or not result.matched:
            _safe_delete(local_path)
            return
    else:
        frame_dir = _extract_sparse_frames(local_path)
        if not frame_dir:
            _safe_delete(local_path)
            return
        try:
            for frame_name in sorted(os.listdir(frame_dir)):
                frame_path = os.path.join(frame_dir, frame_name)
                current = _match_image_path(db, frame_path)
                if current and current.matched:
                    result = current
                    shutil.copy(frame_path, local_path + ".match.jpg")
                    break
        finally:
            shutil.rmtree(frame_dir, ignore_errors=True)

        if not result or not result.matched:
            _safe_delete(local_path)
            return

        matched_frame = local_path + ".match.jpg"
        if os.path.exists(matched_frame):
            _safe_delete(local_path)
            local_path = matched_frame
        else:
            _safe_delete(local_path)
            return

    extracted = _extract_watermark_from_path(local_path)
    watermark_verified = extracted == result.asset_id
    attribution = extracted if watermark_verified else None

    violation_id = str(uuid4())
    filename = f"monitor_{violation_id}.jpg"
    violation_path = os.path.join(str(VIOLATION_DIR), filename)
    shutil.move(local_path, violation_path)

    violation = Violation(
        id=violation_id,
        asset_id=result.asset_id,
        source_url=event.url,
        platform=event.platform,
        confidence=result.confidence,
        match_tier="VERIFIED" if watermark_verified else result.match_tier,
        match_type="watermark" if watermark_verified else result.match_type,
        image_path=filename,
        watermark_verified=watermark_verified,
        attribution=attribution,
        scraped_text=event.scraped_text,
        views=event.views,
    )
    db.add(violation)
    db.flush()

    edge = PropagationEdge(
        id=str(uuid4()),
        source_asset_id=result.asset_id,
        violation_id=violation_id,
        platform=event.platform,
    )
    db.add(edge)
    db.commit()

    fire_and_forget_broadcast(
        {
            "type": "violation_alert",
            "violation": {
                "violation_id": violation_id,
                "asset_id": result.asset_id,
                "asset_name": result.asset_name,
                "confidence": result.confidence,
                "match_tier": violation.match_tier,
                "match_type": violation.match_type,
                "source_url": event.url,
                "platform": event.platform,
                "watermark_verified": watermark_verified,
                "attribution": attribution,
            },
        }
    )


def _extract_watermark_from_path(image_path: str) -> str | None:
    try:
        image = Image.open(image_path).convert("RGB")
        return extract_watermark(image)
    except Exception:
        return None


def _download_media(url: str) -> tuple[str, str | None]:
    if _is_video_url(url):
        path = _download_video(url)
        return ("video", path)

    suffix = ".jpg"
    if any(url.lower().endswith(ext) for ext in [".png", ".webp"]):
        suffix = os.path.splitext(url)[1] or ".jpg"

    fd, tmp_path = tempfile.mkstemp(prefix="mediashield_", suffix=suffix)
    os.close(fd)
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            with open(tmp_path, "wb") as f:
                f.write(r.read())
        return ("image", tmp_path)
    except Exception:
        _safe_delete(tmp_path)
        return ("", None)


def _match_image_path(db, image_path: str):
    try:
        image = Image.open(image_path).convert("RGB")
        return match_image(image, db)
    except Exception:
        return None


def _is_video_url(url: str) -> bool:
    lowered = url.lower()
    return (
        "youtube.com/watch" in lowered
        or "youtu.be/" in lowered
        or any(lowered.endswith(ext) for ext in [".mp4", ".mov", ".mkv", ".webm"])
    )


def _download_video(url: str) -> str | None:
    fd, tmp_path = tempfile.mkstemp(prefix="mediashield_video_", suffix=".mp4")
    os.close(fd)
    _safe_delete(tmp_path)

    out_template = tmp_path.replace(".mp4", ".%(ext)s")
    cmd = ["yt-dlp", "-f", "mp4", "-o", out_template, url]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        return None

    candidates = [
        tmp_path,
        tmp_path.replace(".mp4", ".mkv"),
        tmp_path.replace(".mp4", ".webm"),
        tmp_path.replace(".mp4", ".mov"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def _extract_sparse_frames(video_path: str) -> str | None:
    frame_dir = tempfile.mkdtemp(prefix="mediashield_frames_")
    frame_pattern = os.path.join(frame_dir, "frame_%05d.jpg")
    cmd = [
        "ffmpeg",
        "-i",
        video_path,
        "-vf",
        "fps=1/2",
        "-q:v",
        "2",
        frame_pattern,
        "-y",
    ]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        shutil.rmtree(frame_dir, ignore_errors=True)
        return None

    if not os.listdir(frame_dir):
        shutil.rmtree(frame_dir, ignore_errors=True)
        return None
    return frame_dir


def _safe_delete(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass
