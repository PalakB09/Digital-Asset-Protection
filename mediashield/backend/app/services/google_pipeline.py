"""
Google / Web pipeline — uses DuckDuckGo Search (no API key required).

Dual-mode search:
  1) Web Search  → fetch result URLs, visit pages, extract & scan images
  2) Image Search → fetch image URLs directly, download & scan

Falls back gracefully:
  - If DDG image search is rate-limited, silently skips (web search still runs)
  - Polite delays between keywords to avoid DDG rate-limiting
"""

import logging
import os
import random
import time
import requests
from typing import List, Dict
from urllib.parse import urljoin, urlparse
from io import BytesIO
from bs4 import BeautifulSoup
from PIL import Image

from app.database import SessionLocal
from app.models.asset import Asset
from app.services.scanner import scan_image
from app.services.alerts import fire_and_forget_broadcast

log = logging.getLogger(__name__)

# Use the renamed 'ddgs' package (successor to duckduckgo_search)

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
]

def _rand_ua() -> str:
    return random.choice(_USER_AGENTS)

def _polite_sleep(base: float = 2.0, jitter: float = 3.0):
    time.sleep(base + random.uniform(0, jitter))


# ═══════════════════════════════════════════════════════════════
#  DuckDuckGo search wrappers
# ═══════════════════════════════════════════════════════════════

def _ddg_web_search(keyword: str, num_results: int = 10) -> List[str]:
    """DuckDuckGo text search — returns list of URLs."""
    try:
        from ddgs import DDGS
        results = DDGS().text(keyword, max_results=num_results)
        links = [r["href"] for r in results if r.get("href")]
        log.info("[search:web] keyword='%s' → %d links", keyword, len(links))
        return links
    except Exception as e:
        err = str(e).lower()
        if "ratelimit" in err or "403" in err:
            log.warning("[search:web] DDG rate-limited for '%s'", keyword)
        else:
            log.error("[search:web] DDG search failed for '%s': %s", keyword, e)
        return []


def _ddg_image_search(keyword: str, num_results: int = 10) -> List[str]:
    """DuckDuckGo image search — returns list of direct image URLs."""
    try:
        from ddgs import DDGS
        results = DDGS().images(keyword, max_results=num_results)
        urls = [r["image"] for r in results if r.get("image")]
        log.info("[search:images] keyword='%s' → %d images", keyword, len(urls))
        return urls
    except Exception as e:
        err = str(e).lower()
        if "ratelimit" in err or "403" in err:
            log.warning("[search:images] DDG image search rate-limited for '%s', skipping", keyword)
        else:
            log.error("[search:images] DDG image search failed for '%s': %s", keyword, e)
        return []


# ═══════════════════════════════════════════════════════════════
#  Page image extraction (for web search results)
# ═══════════════════════════════════════════════════════════════

def scrape_images_from_url(url: str) -> Dict[str, object]:
    """Scrapes a URL, returning page title and list of image src urls."""
    try:
        resp = requests.get(url, headers={"User-Agent": _rand_ua()}, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        title_tag = soup.find("title")
        page_title = title_tag.text.strip() if title_tag else ""
        img_urls = set()
        for img in soup.find_all("img"):
            src = img.get("src")
            if not src:
                continue
            width = img.get("width")
            height = img.get("height")
            if width and height:
                try:
                    if int(width) < 50 or int(height) < 50:
                        continue
                except ValueError:
                    pass
            abs_url = urljoin(url, src)
            parsed = urlparse(abs_url)
            if parsed.path.lower().endswith((".svg", ".gif", ".ico")):
                continue
            img_urls.add(abs_url)
        return {"title": page_title, "images": list(img_urls)}
    except Exception as e:
        log.debug("[search] Failed to scrape webpage %s: %s", url, e)
        return {"title": "", "images": []}


# ═══════════════════════════════════════════════════════════════
#  Main per-asset pipeline
# ═══════════════════════════════════════════════════════════════

def run_google_scrape_for_asset(asset_id: str, max_keywords: int = 10, results_per_keyword: int = 10) -> dict:
    """
    Dual-mode web search for a specific asset:
      1) Web Search — fetch links, visit pages, extract images, scan
      2) Image Search — fetch image URLs directly, download & scan
    Uses DuckDuckGo (no API key needed, no 429/CAPTCHA from Google).
    """
    db = SessionLocal()
    try:
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            return {"ok": False, "error": "asset not found"}

        keywords = asset.keywords_list()
        if not keywords:
            return {"ok": False, "error": "No keywords on asset"}

        discovered = []
        violations_created = 0
        seen_urls: set[str] = set()
        total_keywords = min(len(keywords), max_keywords)

        log.info("[search:asset] Starting web+image search for '%s' (%d keywords)",
                 asset.name, total_keywords)

        for idx, keyword in enumerate(keywords[:max_keywords]):
            log.info("[search:asset] Processing keyword %d/%d: '%s'",
                     idx + 1, total_keywords, keyword)

            # ─── MODE 1: Web Search ────────────────────────────
            links = _ddg_web_search(keyword, num_results=results_per_keyword)
            for link in links:
                if link in seen_urls:
                    continue
                seen_urls.add(link)

                scraped_data = scrape_images_from_url(link)
                page_title = scraped_data["title"]

                for img_url in scraped_data["images"][:5]:
                    try:
                        resp = requests.get(img_url, headers={"User-Agent": _rand_ua()}, timeout=8)
                        resp.raise_for_status()
                        if len(resp.content) < 1000:  # skip tiny images
                            continue
                        image = Image.open(BytesIO(resp.content)).convert("RGB")

                        out = scan_image(
                            image, db,
                            source_url=link, platform="web",
                            image_path=img_url, context_text=page_title,
                        )

                        if out.get("matched"):
                            violations_created += 1
                            discovered.append({
                                "mode": "web", "keyword": keyword,
                                "page_url": link, "image_url": img_url,
                                "title": page_title, "match": out,
                            })
                            fire_and_forget_broadcast({
                                "type": "violation_alert",
                                "violation": {
                                    "violation_id": out.get("violation_id"),
                                    "asset_id": out.get("asset_id"),
                                    "platform": "web",
                                    "source_url": link,
                                },
                            })
                            break  # one match per page is enough
                    except Exception as e:
                        log.debug("[search] Failed to process web image %s: %s", img_url, e)

            # ─── Polite delay between modes ────────────────────
            _polite_sleep(1.5, 2.5)

            # ─── MODE 2: Image Search ─────────────────────────
            image_urls = _ddg_image_search(keyword, num_results=results_per_keyword)
            for img_url in image_urls:
                if img_url in seen_urls:
                    continue
                seen_urls.add(img_url)

                try:
                    resp = requests.get(img_url, headers={"User-Agent": _rand_ua()}, timeout=8)
                    resp.raise_for_status()
                    if len(resp.content) < 1000:
                        continue
                    image = Image.open(BytesIO(resp.content)).convert("RGB")

                    out = scan_image(
                        image, db,
                        source_url=img_url, platform="web",
                        image_path=img_url, context_text=keyword,
                    )

                    if out.get("matched"):
                        violations_created += 1
                        discovered.append({
                            "mode": "images", "keyword": keyword,
                            "image_url": img_url, "match": out,
                        })
                        fire_and_forget_broadcast({
                            "type": "violation_alert",
                            "violation": {
                                "violation_id": out.get("violation_id"),
                                "asset_id": out.get("asset_id"),
                                "platform": "web",
                                "source_url": img_url,
                            },
                        })
                except Exception as e:
                    log.debug("[search] Failed to process image %s: %s", img_url, e)

            # ─── Polite delay between keywords ──────────────────
            if idx < total_keywords - 1:
                _polite_sleep(3.0, 5.0)

        return {
            "ok": True,
            "asset_id": asset_id,
            "asset_name": asset.name,
            "keywords_used": total_keywords,
            "violations_created": violations_created,
            "discovered": discovered,
        }
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════
#  Standalone query-based scan (manual trigger)
# ═══════════════════════════════════════════════════════════════

async def run_google_scrape_for_query(keyword: str, max_results: int = 15) -> dict:
    """Manual trigger: searches for images and scans them against all assets."""
    db = SessionLocal()
    violations_created = 0
    discovered = []

    try:
        image_urls = _ddg_image_search(keyword, num_results=max_results)

        for src in image_urls:
            try:
                resp = requests.get(src, headers={"User-Agent": _rand_ua()}, timeout=8)
                if resp.status_code != 200 or len(resp.content) < 1000:
                    continue
                image_obj = Image.open(BytesIO(resp.content)).convert("RGB")

                out = scan_image(
                    image_obj, db,
                    source_url=src, platform="web",
                    image_path=src, context_text=keyword,
                )

                if out.get("matched"):
                    violations_created += 1
                    discovered.append({
                        "keyword": keyword, "image_url": src, "match": out,
                    })
                    fire_and_forget_broadcast({
                        "type": "violation_alert",
                        "violation": {
                            "violation_id": out.get("violation_id"),
                            "asset_id": out.get("asset_id"),
                            "platform": "web",
                            "source_url": src,
                        },
                    })
            except Exception:
                pass
    finally:
        db.close()

    return {"ok": True, "query": keyword, "violations_created": violations_created}
