"""
Gemini keyword generation for assets (image/video).

Uses the official `google.genai` SDK (not deprecated `google.generativeai`).

- API key: `GEMINI_API_KEY` from backend/.env (see app.config)
- Model id: fixed in app.config (GEMINI_MODEL); `models/` prefix is stripped for the new client.
"""

from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING

from app.config import GEMINI_API_KEY, GEMINI_MODEL

if TYPE_CHECKING:
    from PIL import Image

log = logging.getLogger(__name__)

_PROMPT = """You catalog media for digital rights and anti-piracy tracking.

Look ONLY at the actual pixels in the attached image(s). Describe what is visibly happening
(sport, teams, logos, venue, jersey colors, scoreboard text if readable, on-screen graphics,
camera angle, indoor/outdoor, crowd, studio, interview, highlight replay, vertical reel crop, etc.).

Produce 6–12 short search phrases (2–6 words each) that would help find this SAME content
on social platforms (YouTube, Instagram Reels, TikTok, X). Phrases must be grounded in what
you see — do not invent events or teams that are not visible.

Respond with ONLY a valid JSON array of strings. No markdown, no explanation.

Example (illustrative only):
["IPL 2026 highlights", "CSK vs MI reel", "match clip short"]
"""


def _normalize_model_id(model: str) -> str:
    m = (model or "").strip()
    if m.startswith("models/"):
        m = m[len("models/") :]
    return m or "gemini-2.0-flash"


def _parse_json_array(text: str, *, ctx: str = "") -> list[str]:
    text = (text or "").strip()
    if not text:
        log.warning("[gemini_keywords] parse failed: empty model text | ctx=%s", ctx)
        return []
    raw_for_log = text[:500].replace("\n", " ")
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```\s*$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\[[\s\S]*\]", text)
        if not m:
            log.warning(
                "[gemini_keywords] parse failed: not valid JSON / no array found | ctx=%s | preview=%r",
                ctx,
                raw_for_log,
            )
            return []
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            log.warning(
                "[gemini_keywords] parse failed: array substring invalid JSON | ctx=%s | preview=%r",
                ctx,
                raw_for_log,
            )
            return []
    if not isinstance(data, list):
        log.warning(
            "[gemini_keywords] parse failed: root is %s not list | ctx=%s | preview=%r",
            type(data).__name__,
            ctx,
            raw_for_log,
        )
        return []
    out: list[str] = []
    for x in data:
        s = str(x).strip()
        if s and s not in out:
            out.append(s)
        if len(out) >= 24:
            break
    if not out:
        log.warning(
            "[gemini_keywords] parse failed: list had no non-empty strings | ctx=%s | preview=%r",
            ctx,
            raw_for_log,
        )
    return out


def _log_gemini_response(resp: object, model_id: str) -> None:
    """Log safety / candidate metadata (never log API key)."""
    pf = getattr(resp, "prompt_feedback", None)
    if pf is not None:
        br = getattr(pf, "block_reason", None)
        if br:
            log.warning("[gemini_keywords] prompt_feedback.block_reason=%s model=%s", br, model_id)
    cands = getattr(resp, "candidates", None) or []
    log.info("[gemini_keywords] response candidates=%d model=%s", len(cands), model_id)
    for i, c in enumerate(cands[:3]):
        fr = getattr(c, "finish_reason", None)
        sr = getattr(c, "safety_ratings", None)
        log.info(
            "[gemini_keywords]   candidate[%d] finish_reason=%s safety_ratings=%s",
            i,
            fr,
            sr,
        )


def generate_keywords_from_images(images: list[Image.Image], filename_hint: str = "") -> list[str]:
    ctx = f"hint={filename_hint[:120]!r}" if filename_hint else "hint=(none)"
    if not GEMINI_API_KEY:
        log.warning(
            "[gemini_keywords] skip: GEMINI_API_KEY missing — set it in backend/.env | %s",
            ctx,
        )
        return []
    if not images:
        log.warning("[gemini_keywords] skip: no images | %s", ctx)
        return []

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        log.warning("[gemini_keywords] skip: google-genai not installed (pip install google-genai)")
        return []

    model_id = _normalize_model_id(GEMINI_MODEL)
    log.info(
        "[gemini_keywords] start model_id=%s (config=%s) image_count=%d %s",
        model_id,
        GEMINI_MODEL,
        len(images),
        ctx,
    )
    client = genai.Client(api_key=GEMINI_API_KEY)

    parts: list = [_PROMPT]
    if filename_hint:
        parts.append(f"Filename hint: {filename_hint}\n")
    for im in images:
        parts.append(im.convert("RGB"))

    try:
        resp = client.models.generate_content(
            model=model_id,
            contents=parts,
            config=types.GenerateContentConfig(
                temperature=0.35,
                max_output_tokens=512,
            ),
        )
    except Exception as e:
        log.warning(
            "[gemini_keywords] API error model_id=%s %s: %s",
            model_id,
            ctx,
            e,
            exc_info=True,
        )
        return []

    _log_gemini_response(resp, model_id)

    text = ""
    try:
        text = (resp.text or "").strip()
    except Exception as ex:
        log.warning(
            "[gemini_keywords] could not read resp.text model_id=%s %s: %s",
            model_id,
            ctx,
            ex,
        )
        text = ""
    if not text:
        log.warning(
            "[gemini_keywords] empty text from model model_id=%s %s — check block_reason / finish_reason above",
            model_id,
            ctx,
        )
        return []

    parsed = _parse_json_array(text, ctx=f"model={model_id} {ctx}")
    if parsed:
        log.info("[gemini_keywords] success count=%d model_id=%s %s", len(parsed), model_id, ctx)
    else:
        log.warning(
            "[gemini_keywords] no keywords after parse model_id=%s raw_len=%d %s | raw_preview=%r",
            model_id,
            len(text),
            ctx,
            text[:400],
        )
    return parsed


def generate_keywords_for_video_frames(
    video_path: str, filename_hint: str = "", n_preview_frames: int = 3
) -> list[str]:
    from app.services.video_fingerprint import extract_frames

    try:
        frames = extract_frames(video_path, n_preview_frames)
    except Exception as e:
        log.warning(
            "[gemini_keywords] video frame extract failed path=%r n=%s: %s",
            video_path[-80:] if video_path else "",
            n_preview_frames,
            e,
        )
        return []
    log.info(
        "[gemini_keywords] video preview frames=%d path_suffix=%r",
        len(frames),
        video_path[-80:] if video_path else "",
    )
    return generate_keywords_from_images(frames, filename_hint=filename_hint)
