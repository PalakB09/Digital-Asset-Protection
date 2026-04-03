#!/usr/bin/env python3
"""
One-time login for Telethon (saves session under storage/telegram/).

Usage (from the backend folder):
  pip install telethon
  python scripts/telegram_login.py

Requires in backend/.env:
  TELEGRAM_API_ID
  TELEGRAM_API_HASH
  TELEGRAM_PHONE (international format, e.g. +9198xxxxxxx)
"""

import asyncio
import os
import sys

# backend/ as cwd for imports
_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

os.chdir(_BACKEND)


async def main() -> None:
    from telethon import TelegramClient

    from app.config import (
        TELEGRAM_API_HASH,
        TELEGRAM_API_ID,
        TELEGRAM_PHONE,
        TELEGRAM_SESSION_PATH,
        telegram_configured,
    )

    if not telegram_configured():
        print("Set TELEGRAM_API_ID and TELEGRAM_API_HASH in backend/.env (see .env.example).")
        sys.exit(1)
    if not TELEGRAM_PHONE:
        print("Set TELEGRAM_PHONE in backend/.env (E.164, e.g. +9198xxxxxxx).")
        sys.exit(1)

    client = TelegramClient(str(TELEGRAM_SESSION_PATH), TELEGRAM_API_ID, TELEGRAM_API_HASH)
    await client.start(phone=TELEGRAM_PHONE)
    me = await client.get_me()
    print(f"Logged in as {me.id} (@{getattr(me, 'username', None) or 'no username'})")
    print(f"Session file: {TELEGRAM_SESSION_PATH}.session")
    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
