import logging
import os
import requests
from typing import List, Dict
from io import BytesIO
from PIL import Image

from app.config import YOUTUBE_API_KEY
from app.database import SessionLocal
from app.models.asset import Asset
from app.services.scanner import scan_image
from app.services.alerts import fire_and_forget_broadcast
from googleapiclient.discovery import build

log = logging.getLogger(__name__)

def _get_youtube_service():
    if not YOUTUBE_API_KEY:
        log.error("YOUTUBE_API_KEY is not set. YouTube pipeline cannot run.")
        return None
    try:
        service = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY, cache_discovery=False)
        return service
    except Exception as e:
        log.error(f"Failed to build YouTube service: {e}")
        return None

def fetch_youtube_results(keyword: str, max_results: int = 20) -> List[Dict]:
    service = _get_youtube_service()
    if not service:
        return []
    
    try:
        request = service.search().list(
            part="snippet",
            q=keyword,
            type="video",
            maxResults=max_results
        )
        response = request.execute()
        
        results = []
        for item in response.get("items", []):
            video_id = item["id"]["videoId"]
            snippet = item["snippet"]
            title = snippet.get("title", "")
            
            # Get best thumbnail
            thumbnails = snippet.get("thumbnails", {})
            best_thumb_url = ""
            for res in ["high", "medium", "default"]:
                if res in thumbnails:
                    best_thumb_url = thumbnails[res]["url"]
                    break
                    
            if not best_thumb_url:
                continue
                
            results.append({
                "video_url": f"https://www.youtube.com/watch?v={video_id}",
                "title": title,
                "thumbnail_url": best_thumb_url,
                "channel_title": snippet.get("channelTitle", "")
            })
        return results
    except Exception as e:
        log.error(f"YouTube search failed for keyword '{keyword}': {e}")
        return []

def run_youtube_scrape_for_asset(asset_id: str, max_keywords: int = 5, results_per_keyword: int = 20) -> dict:
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
        seen_urls = set()
        
        for keyword in keywords[:max_keywords]:
            videos = fetch_youtube_results(keyword, max_results=results_per_keyword)
            # Add small sleep if this loop gets complex to avoid rapid API bursts
            for vid in videos:
                vid_url = vid["video_url"]
                if vid_url in seen_urls:
                    continue
                seen_urls.add(vid_url)
                
                thumb_url = vid["thumbnail_url"]
                title = vid["title"]
                
                try:
                    # Download thumbnail
                    resp = requests.get(thumb_url, timeout=10)
                    resp.raise_for_status()
                    image = Image.open(BytesIO(resp.content)).convert("RGB")
                    
                    # Run hybrid scanner
                    out = scan_image(
                        image, 
                        db, 
                        source_url=vid_url, 
                        platform="youtube", 
                        image_path=thumb_url,
                        context_text=title
                    )
                    
                    if out.get("matched"):
                        violations_created += 1
                        discovered.append({
                            "keyword": keyword,
                            "video_url": vid_url,
                            "title": title,
                            "match": out
                        })
                        fire_and_forget_broadcast(
                            {
                                "type": "violation_alert",
                                "violation": {
                                    "violation_id": out.get("violation_id"),
                                    "asset_id": out.get("asset_id"),
                                    "platform": "youtube",
                                    "source_url": vid_url,
                                },
                            }
                        )
                except Exception as e:
                    log.error(f"Failed to process YouTube video thumbnail {vid_url}: {e}")
                    
        return {
            "ok": True,
            "asset_id": asset_id,
            "asset_name": asset.name,
            "violations_created": violations_created,
            "discovered": discovered
        }
    finally:
        db.close()


def run_youtube_scrape_for_query(keyword: str, results_per_keyword: int = 15) -> dict:
    """Manual trigger scanner: fetches YouTube results for a specific query and scans against ALL assets."""
    db = SessionLocal()
    try:
        discovered = []
        violations_created = 0
        
        videos = fetch_youtube_results(keyword, max_results=results_per_keyword)
        for vid in videos:
            vid_url = vid["video_url"]
            thumb_url = vid["thumbnail_url"]
            title = vid["title"]
            
            try:
                resp = requests.get(thumb_url, timeout=10)
                resp.raise_for_status()
                image = Image.open(BytesIO(resp.content)).convert("RGB")
                
                out = scan_image(
                    image, 
                    db, 
                    source_url=vid_url, 
                    platform="youtube", 
                    image_path=thumb_url,
                    context_text=title
                )
                
                if out.get("matched"):
                    violations_created += 1
                    discovered.append({
                        "video_url": vid_url,
                        "title": title,
                        "match": out
                    })
                    fire_and_forget_broadcast(
                        {
                            "type": "violation_alert",
                            "violation": {
                                "violation_id": out.get("violation_id"),
                                "asset_id": out.get("asset_id"),
                                "platform": "youtube",
                                "source_url": vid_url,
                            },
                        }
                    )
            except Exception as e:
                log.error(f"Manual scan failed processing YouTube thumb {thumb_url}: {e}")
                
        return {
            "ok": True,
            "query": keyword,
            "violations_created": violations_created,
            "discovered": discovered
        }
    finally:
        db.close()
