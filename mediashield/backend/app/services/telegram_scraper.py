"""
Telegram discovery using Telethon (user session).

Uses global search + per-channel message search. Respects FloodWait.
Public channels / joined groups only — see TELEGRAM_SETUP.md.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any, Awaitable, Callable, TypeVar

log = logging.getLogger(__name__)

T = TypeVar("T")


async def _with_flood_wait(coro_factory: Callable[[], Awaitable[T]], retries: int = 2) -> T:
    """Run async call; on FloodWait, sleep and retry."""
    try:
        from telethon.errors import FloodWaitError
    except ImportError:
        return await coro_factory()

    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        try:
            return await coro_factory()
        except FloodWaitError as e:
            last_exc = e
            wait = int(getattr(e, "seconds", 5)) + 2
            log.warning("[telegram] FloodWait %ss (attempt %s)", wait, attempt)
            await asyncio.sleep(wait)
    raise last_exc  # type: ignore[misc]


def build_client():
    """TelegramClient instance (not started)."""
    from telethon import TelegramClient

    from app.config import (
        TELEGRAM_API_HASH,
        TELEGRAM_API_ID,
        TELEGRAM_SESSION_PATH,
    )

    return TelegramClient(str(TELEGRAM_SESSION_PATH), TELEGRAM_API_ID, TELEGRAM_API_HASH)


async def find_public_channels_by_keyword(client, keyword: str, limit: int = 20) -> list[dict[str, Any]]:
    """Search Telegram for public channels/groups matching a keyword."""
    from telethon.tl.functions.contacts import SearchRequest as ContactsSearchRequest
    from telethon.tl.types import Channel

    async def _run():
        res = await client(ContactsSearchRequest(q=keyword, limit=limit))
        out: list[dict[str, Any]] = []
        for chat in res.chats:
            if not isinstance(chat, Channel):
                continue
            username = getattr(chat, "username", None) or None
            if not username:
                continue
            out.append(
                {
                    "id": chat.id,
                    "title": getattr(chat, "title", "") or "",
                    "username": username,
                    "participants_count": getattr(chat, "participants_count", 0) or 0,
                }
            )
        return out

    return await _with_flood_wait(_run)


async def search_messages_in_channel(
    client,
    channel_username: str,
    keyword: str,
    limit: int = 30,
) -> list[dict[str, Any]]:
    """Search messages in one channel/supergroup (must be joinable / public username)."""
    uname = channel_username.lstrip("@")

    async def _run():
        entity = await client.get_entity(uname)
        username = getattr(entity, "username", None) or uname
        found: list[dict[str, Any]] = []
        async for msg in client.iter_messages(entity, search=keyword, limit=limit):
            if not msg or not msg.media:
                continue
            url = f"https://t.me/{username}/{msg.id}"
            found.append(
                {
                    "message_id": msg.id,
                    "channel_username": username,
                    "url": url,
                    "date": msg.date.isoformat() if msg.date else None,
                    "has_photo": bool(msg.photo),
                    "has_document": bool(msg.document),
                }
            )
        return found

    return await _with_flood_wait(_run)


async def download_message_media(
    client,
    channel_username: str,
    message_id: int,
    dest_path: Path,
    max_bytes: int,
) -> str | None:
    """Download media for a message to dest_path (file or dir). Returns path string or None."""
    uname = channel_username.lstrip("@")

    async def _run():
        msg = await client.get_messages(uname, ids=message_id)
        if not msg or not msg.media:
            return None
        doc = getattr(msg.media, "document", None)
        if doc and getattr(doc, "size", 0) and doc.size > max_bytes:
            log.info("[telegram] skip large file %s bytes", doc.size)
            return None
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        path = await client.download_media(msg, file=str(dest_path))
        return str(path) if path else None

    return await _with_flood_wait(_run)
