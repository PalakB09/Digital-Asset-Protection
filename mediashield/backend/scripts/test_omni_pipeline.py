import sys
import os

# Add backend dir to python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.asset import Asset
from app.services.youtube_pipeline import run_youtube_scrape_for_asset
from app.services.google_pipeline import run_google_scrape_for_asset

def test():
    db = SessionLocal()
    try:
        asset = db.query(Asset).first()
        if not asset:
            print("No assets found in the DB. Please register one via the UI first.")
            return

        print(f"Testing Omni-Pipelines for Asset ID: {asset.id} (Name: {asset.name})")
        
        keywords = asset.keywords_list()
        if not keywords:
            asset.keywords = '["spiderman", "marvel"]' # temporary mock for test
            db.commit()
            db.refresh(asset)
            print("Injected test keywords: spiderman, marvel")
        
        print(f"Keywords: {asset.keywords_list()}")
        
        print("\n--- Running Google Web Pipeline ---")
        try:
            google_results = run_google_scrape_for_asset(asset.id, max_keywords=1, results_per_keyword=3)
            print(f"Google pipeline OK: {google_results.get('ok')}")
            for d in google_results.get('discovered', []):
                print(f"   -> Found Match at: {d['page_url']}")
                print(f"      Image Src: {d['image_url']}")
                print(f"      Context Title: '{d['title']}'")
                print(f"      Hybrid Confidence: {d['match'].get('confidence')}")
            if not google_results.get('discovered'):
                print("   -> No matches found on Google Web for the keywords.")
        except Exception as e:
            print(f"Google pipeline failed to run: {e}")

        print("\n--- Running YouTube Pipeline ---")
        try:
            yt_results = run_youtube_scrape_for_asset(asset.id, max_keywords=1, results_per_keyword=3)
            print(f"YouTube pipeline OK: {yt_results.get('ok')}")
            if yt_results.get('error'):
                print(f"   -> Error: {yt_results.get('error')}")
            for d in yt_results.get('discovered', []):
                print(f"   -> Found Match at: {d['video_url']}")
                print(f"      Context Title: '{d['title']}'")
                print(f"      Hybrid Confidence: {d['match'].get('confidence')}")
            if getattr(yt_results, 'get', lambda x: None)('ok') and not yt_results.get('discovered'):
                print("   -> No matches found on YouTube for the keywords.")
        except Exception as e:
            print(f"YouTube pipeline failed to run: {e}")
            
    finally:
        db.close()

if __name__ == "__main__":
    test()
