"""
Realtime alert broadcasting for detected violations.
"""

import asyncio
from fastapi import WebSocket


class AlertManager:
    def __init__(self):
        self._clients: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self._clients.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self._clients.discard(websocket)

    async def broadcast(self, payload: dict):
        if not self._clients:
            return

        disconnected: list[WebSocket] = []
        for ws in self._clients:
            try:
                await ws.send_json(payload)
            except Exception:
                disconnected.append(ws)

        for ws in disconnected:
            self.disconnect(ws)


alert_manager = AlertManager()


def fire_and_forget_broadcast(payload: dict):
    """Best-effort helper for contexts where we cannot await directly."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(alert_manager.broadcast(payload))
    except RuntimeError:
        # No event loop; this path is safe to ignore in sync/offline calls.
        pass
