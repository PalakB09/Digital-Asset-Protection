"""
Webhook router for YouTube WebSub notifications.
"""

from typing import Optional
import xml.etree.ElementTree as ET

from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse

from app.services.monitoring import PostEvent, enqueue_post_event

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.get("/youtube", response_class=PlainTextResponse)
async def youtube_websub_challenge(
    hub_challenge: Optional[str] = None,
):
    # WebSub verification flow expects challenge echoed back.
    return hub_challenge or "ok"


@router.post("/youtube")
async def youtube_websub_notify(request: Request):
    body = await request.body()
    try:
        root = ET.fromstring(body)
    except Exception:
        return {"accepted": False, "reason": "invalid_xml"}

    ns = {
        "atom": "http://www.w3.org/2005/Atom",
        "yt": "http://www.youtube.com/xml/schemas/2015",
    }

    accepted = 0
    for entry in root.findall("atom:entry", ns):
        video_id_el = entry.find("yt:videoId", ns)
        channel_id_el = entry.find("yt:channelId", ns)
        published_el = entry.find("atom:published", ns)

        if video_id_el is None or not video_id_el.text:
            continue

        video_id = video_id_el.text
        channel_id = channel_id_el.text if channel_id_el is not None else "unknown"
        published = published_el.text if published_el is not None else ""
        video_url = f"https://www.youtube.com/watch?v={video_id}"

        result = await enqueue_post_event(
            PostEvent(
                post_id=f"youtube:{video_id}",
                url=video_url,
                media_urls=[video_url],
                timestamp=published,
                platform="youtube",
            )
        )
        if result.get("accepted"):
            accepted += 1

    return {"accepted": accepted}
