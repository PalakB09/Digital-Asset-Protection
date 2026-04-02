"""
Download image or video media from a URL (used by scan and asset registration).
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
import urllib.request
from urllib.parse import urlparse


def is_video_url(url: str) -> bool:
    lowered = url.lower()
    return (
        "youtube.com" in lowered
        or "youtu.be/" in lowered
        or "tiktok.com" in lowered
        or "twitter.com" in lowered
        or "x.com" in lowered
        or "instagram.com/reel" in lowered
        or "vimeo.com" in lowered
        or any(lowered.endswith(ext) for ext in [".mp4", ".mov", ".mkv", ".webm", ".avi"])
    )


def download_image_from_url(url: str) -> tuple[str | None, str]:
    """
    Download image bytes to a temp file. Returns (path, content_type) or (None, "").
    Handles direct images and simple HTML pages with og:image.
    """
    suffix = ".jpg"
    parsed_path = urlparse(url).path.lower()
    if parsed_path.endswith((".png", ".webp", ".jpeg", ".jpg")):
        suffix = os.path.splitext(parsed_path)[1] or ".jpg"

    fd, tmp_path = tempfile.mkstemp(prefix="mediashield_fetch_", suffix=suffix)
    os.close(fd)
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            content_type = (response.headers.get("Content-Type") or "").lower()
            data = response.read()

        if "text/html" in content_type:
            html_content = data.decode("utf-8", errors="ignore")
            match = (
                re.search(r'<meta property="og:image"\s+content="([^"]+)"', html_content)
                or re.search(r'<meta name="twitter:image"\s+content="([^"]+)"', html_content)
                or re.search(r'<img[^>]+src="([^"]+)"', html_content)
            )

            if match:
                extracted_url = match.group(1).replace("&#x2F;", "/")
                if not extracted_url.startswith("http"):
                    import urllib.parse

                    extracted_url = urllib.parse.urljoin(url, extracted_url)

                req = urllib.request.Request(
                    extracted_url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    },
                )
                with urllib.request.urlopen(req, timeout=30) as img_resp:
                    content_type = (img_resp.headers.get("Content-Type") or "").lower()
                    data = img_resp.read()
            else:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
                return None, ""

        with open(tmp_path, "wb") as f:
            f.write(data)
        return tmp_path, content_type
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        return None, ""


def download_video_from_url(url: str) -> str | None:
    """Download best-effort video via yt-dlp into a temp path. Returns path or None."""
    fd, tmp_path = tempfile.mkstemp(prefix="mediashield_fetch_video_", suffix=".mp4")
    os.close(fd)
    if os.path.exists(tmp_path):
        os.remove(tmp_path)

    out_template = tmp_path.replace(".mp4", ".%(ext)s")
    cmd = [sys.executable, "-m", "yt_dlp", "-f", "best[ext=mp4]/best", "-o", out_template, url]
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
    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate
    return None
