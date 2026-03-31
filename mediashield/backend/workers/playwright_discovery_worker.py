"""
Playwright discovery worker.

Periodically polls configured pages, discovers new post URLs, and pushes
PostEvent payloads to MediaShield monitoring endpoint.
"""

import asyncio
import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import httpx
from playwright.async_api import async_playwright


@dataclass
class DiscoveryTarget:
    name: str
    platform: str
    url: str
    post_selector: str
    post_url_attr: str = "href"
    media_selector: str = "img, video, source"
    include_patterns: list[str] | None = None
    max_posts: int = 20
    wait_for_selector: str | None = None


DEFAULT_ENDPOINT = "http://localhost:8000/api/monitoring/events"
DEFAULT_POLL_INTERVAL_SEC = 15
DEFAULT_TIMEOUT_MS = 20000

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_TARGETS_FILE = ROOT_DIR / "workers" / "discovery_targets.json"
DEFAULT_SEEN_FILE = ROOT_DIR / "workers" / ".seen_posts.json"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def stable_post_id(platform: str, url: str) -> str:
    return hashlib.sha256(f"{platform}|{url}".encode("utf-8")).hexdigest()[:24]


def load_targets(path: Path) -> list[DiscoveryTarget]:
    if not path.exists():
        raise FileNotFoundError(
            f"Targets file not found: {path}. Copy workers/discovery_targets.example.json to discovery_targets.json"
        )

    raw = json.loads(path.read_text(encoding="utf-8"))
    targets: list[DiscoveryTarget] = []
    for item in raw:
        targets.append(
            DiscoveryTarget(
                name=item["name"],
                platform=item["platform"],
                url=item["url"],
                post_selector=item["post_selector"],
                post_url_attr=item.get("post_url_attr", "href"),
                media_selector=item.get("media_selector", "img, video, source"),
                include_patterns=item.get("include_patterns") or None,
                max_posts=int(item.get("max_posts", 20)),
                wait_for_selector=item.get("wait_for_selector"),
            )
        )
    return targets


def load_seen_ids(path: Path) -> set[str]:
    if not path.exists():
        return set()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return set(str(x) for x in data)
    except Exception:
        pass
    return set()


def save_seen_ids(path: Path, seen_ids: set[str]):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(sorted(seen_ids), indent=2), encoding="utf-8")


async def extract_from_target(target: DiscoveryTarget, page) -> list[dict[str, Any]]:
    await page.goto(target.url, wait_until="domcontentloaded", timeout=DEFAULT_TIMEOUT_MS)
    if target.wait_for_selector:
        await page.wait_for_selector(target.wait_for_selector, timeout=DEFAULT_TIMEOUT_MS)

    nodes = await page.query_selector_all(target.post_selector)
    items: list[dict[str, Any]] = []

    for node in nodes[: target.max_posts]:
        post_url = await node.get_attribute(target.post_url_attr)
        if not post_url:
            anchor = await node.query_selector("a[href]")
            if anchor:
                post_url = await anchor.get_attribute("href")
        if not post_url:
            continue

        post_url = urljoin(target.url, post_url)

        if target.include_patterns and not any(p in post_url for p in target.include_patterns):
            continue

        media_urls: list[str] = []
        media_nodes = await node.query_selector_all(target.media_selector)
        for m in media_nodes:
            src = (
                await m.get_attribute("src")
                or await m.get_attribute("data-src")
                or await m.get_attribute("poster")
                or await m.get_attribute("content")
            )
            if src:
                media_urls.append(urljoin(target.url, src))

        if not media_urls:
            media_urls = [post_url]

        items.append(
            {
                "post_url": post_url,
                "media_urls": list(dict.fromkeys(media_urls)),
            }
        )

    return items


async def push_event(client: httpx.AsyncClient, endpoint: str, payload: dict[str, Any]) -> bool:
    try:
        response = await client.post(endpoint, json=payload, timeout=20)
        response.raise_for_status()
        data = response.json()
        return bool(data.get("accepted"))
    except Exception:
        return False


async def run_worker():
    endpoint = os.getenv("MEDIASHIELD_MONITORING_ENDPOINT", DEFAULT_ENDPOINT)
    poll_interval = int(os.getenv("MEDIASHIELD_POLL_INTERVAL_SEC", str(DEFAULT_POLL_INTERVAL_SEC)))

    targets_file = Path(os.getenv("MEDIASHIELD_TARGETS_FILE", str(DEFAULT_TARGETS_FILE))).resolve()
    seen_file = Path(os.getenv("MEDIASHIELD_SEEN_FILE", str(DEFAULT_SEEN_FILE))).resolve()

    targets = load_targets(targets_file)
    seen_ids = load_seen_ids(seen_file)

    print(f"Loaded {len(targets)} discovery targets from {targets_file}")
    print(f"Loaded {len(seen_ids)} seen post ids from {seen_file}")
    print(f"Monitoring endpoint: {endpoint}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()

        async with httpx.AsyncClient() as client:
            while True:
                changed = False

                for target in targets:
                    page = await context.new_page()
                    try:
                        discovered = await extract_from_target(target, page)
                    except Exception as exc:
                        print(f"[{target.platform}] {target.name}: extract error: {exc}")
                        await page.close()
                        continue

                    pushed = 0
                    for item in discovered:
                        pid = stable_post_id(target.platform, item["post_url"])
                        if pid in seen_ids:
                            continue

                        payload = {
                            "post_id": pid,
                            "url": item["post_url"],
                            "media_urls": item["media_urls"],
                            "timestamp": utc_now_iso(),
                            "platform": target.platform,
                        }
                        accepted = await push_event(client, endpoint, payload)
                        if accepted:
                            seen_ids.add(pid)
                            changed = True
                            pushed += 1

                    print(
                        f"[{target.platform}] {target.name}: discovered={len(discovered)} new_pushed={pushed}"
                    )
                    await page.close()

                if changed:
                    save_seen_ids(seen_file, seen_ids)

                await asyncio.sleep(max(3, poll_interval))


if __name__ == "__main__":
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        print("Stopped discovery worker")
