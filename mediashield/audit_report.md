# MediaShield System Audit Report

## 1. Project Architecture Overview
**Tech Stack:** 
- **Backend:** Python + FastAPI for routing and orchestration.
- **Database:** SQLite (SQLAlchemy ORM) for relational mapping; ChromaDB for embedded vector storage.
- **AI/ML:** HuggingFace `transformers` (`openai/clip-vit-base-patch32`) for visual embeddings, and `imagehash` for pHash calculations.
- **Video Processing:** `OpenCV` (for deterministic registration sampling), `ffmpeg` via CLI (for sparse asynchronous monitoring frame extraction), and `yt-dlp` for external URLs.
- **Frontend:** Next.js + React + Tailwind CSS (inferred from React package structure in `frontend/`).

**Key Modules:**
- **`assets.py`**: Ingests media, embeds invisible DCT watermarks (images only), creates visual embeddings, and saves to DB. 
- **`scan.py`**: Exposes manual scan capabilities (file uploads and URL inputs) for both images and videos.
- **`monitoring.py` / `playwright_discovery_worker.py`**: A near real-time background processing pipeline for discovering and resolving off-platform URLs.
- **`video_matcher.py` / `video_fingerprint.py`**: Frame extraction handling and `set-similarity` video matching.
- **`vector_store.py`**: Abstraction layer covering ChromaDB client operations.
- **`dmca.py`**: Procedural PDF generation using `fpdf2` for copyright enforcement.

---

## 2. Working Components ✅

1. **Upload & Fingerprinting Flow (Images)**: Extremely robust. Correctly parses requests, deterministically generates asset IDs, successfully intercepts the image stream to mutate it with a DCT watermark, and commits synchronous multi-indexer values (pHash to Postgres/SQLite, CLIP coordinates to Chroma).
2. **Video Frame Generation (DB-side)**: Methodologically correct. The uniformly distributed sampling based on duration ensures reproducible indexing, and the vector storage handles multidimensional grouping.
3. **Core Matching Logic**: The tiered approach successfully queries by Hamming distance (`<= 8`) first to save compute, and realistically defaults to High/Medium Cosine similarity values.
4. **Watermark Extraction**: Successfully extracts the embedded UUID from blue-channel coefficients. Verified recursively on detection (`VERIFIED` tier).
5. **Background Monitoring Engine (The "Playwright/Monitoring" Loop)**: Realistically built async consumer utilizing bounded capacities, a TTL duplicate cache, and resilient error recovery across instances.

---

## 3. Broken Components ❌ (Critical & Major Issues)

### ❌ Critical: Dead Output on Video URL Scans
**Location:** `backend/app/routers/scan.py` -> `scan_from_url` (Lines 245-284)
**Root Cause:** The system downloads a suspect video using `yt-dlp` into a temporary directory to perform matching. If a match succeeds, a violation entry is saved in the database referencing `image_path = f"scan_url_{violation_id}.mp4"`. However, the system never moves the temporary file to `VIOLATION_DIR`, and a `finally:` block executes `os.remove(video_path)`. The media is purged immediately after detection, leaving broken database state.
**Fix:** 
```python
# Before DB commit in scan.py:
filename = f"scan_url_{violation_id}.mp4"
violation_filepath = os.path.join(str(VIOLATION_DIR), filename)
shutil.copy(video_path, violation_filepath)

# Then delete only from temp:
finally:
    if os.path.exists(video_path):
        os.remove(video_path)
```

### ❌ Major: Corrupted Video Playback (`media_type` Hardcoding)
**Location:** `backend/app/routers/violations.py` -> `get_violation_image` (Lines 47-59)
**Root Cause:** The backend explicitly serves all violations (whether they are `.jpg` or `.mp4`) via a static `image/jpeg` MIME type using FastAPI's `FileResponse(filepath, media_type="image/jpeg")`. Modern browsers reject or corrupt MP4 blobs passed as jpegs.
**Fix:**
```python
import mimetypes

@router.get("/{violation_id}/image")
async def get_violation_image(violation_id: str, db: Session = Depends(get_db)):
    # ...
    mime_type, _ = mimetypes.guess_type(filepath)
    return FileResponse(filepath, media_type=mime_type or "application/octet-stream")
```

### ❌ Major: Missing Clean-up causing Disk Bleed
**Location:** `backend/app/routers/scan.py` -> `scan_from_url` (Lines 295-314)
**Root Cause:** The Image variant of `scan_from_url` explicitly moves the downloaded image candidate from tmp to `VIOLATION_DIR` *before* conducting the scan. If the scan returns `matched: False`, the image is never deleted, leading to a silent disk leak for every failed web image scan.
**Fix:**
```python
result = scan_image(...)
if not result.get("matched"):
    if os.path.exists(violation_filepath):
        os.remove(violation_filepath)
```

---

## 4. Partially Implemented ⚠️

### ⚠️ Minor: Video Asset Watermarking
**Location:** `backend/app/routers/assets.py` (Line 130)
**Root Cause:** While image uploads generate and ingest ownership watermarking (`embed_watermark`), the video ingestion pipeline simply copies the file buffer and never applies watermarks (neither temporal nor spatial). Consequentially, the `watermark_verified` DB column will always organically trace back to `False` for matched video assets.
**Status:** Works mathematically via CLIP and UUID generation, but technically falls short of the intended "trace leaks" feature for videos.

---

## 5. Dead / Unused Code 🧹

1. **Vector Store Deletions:** `delete_embedding` and `delete_video_frames` in `vector_store.py` are fully implemented but never utilized. The application lacks asset deletion APIs.
2. **Alert Manager Fire and Forget:** The `fire_and_forget_broadcast` function inside `services/alerts.py` is called correctly inside the monitoring service, but it catches `RuntimeError` due to lack of a global loop if ran synchronously. The FastAPI container is async, so it works, but the synchronous wrapper structure is obsolete since `asyncio.create_task` would natively handle it at the ASGI level.

---

## 6. What is Mocked for the Sake of it 🎭

1. **`youtube_websub_notify`**: Parses atom/XML pings, grabs a Video ID, and submits it to the `monitoring.py` queue. However, WebSub does not immediately push binary media. The payload sets `media_urls=[<watch-url>]`. The queue has to rely entirely on `sys.executable -m yt_dlp` to "discover" the reality of the media blindly, bridging a mocked HTTP trigger to a CLI tool rather than natively scraping data. 
2. **Test Files**: Several zero-linked images exist statically in `backend` (`test_modified.jpg`, `test_scanned.jpg`, etc.) presumably mocked visually by the user to bypass CLI uploads during tests.

---

## 7. Final Verdict

**Is the system logically consistent?** **YES**.
Despite the bugs mentioned above, the *architectural flows* strictly align. The dependency injection graphs map sequentially, the matching pipeline is deterministically separated from I/O boundaries, and schema integrity maps identically between SQLAlchemy representations and expected Pydantic outputs. The integration between React components and FastAPI logic is solid according to `api.ts`.

**What is missing to make it complete?**
1. Fixing the endpoint disk leaks / file mismanagement for URLs and serving proper `.mp4` video mime types.
2. Adding Video watermarking (using `FFmpeg` filters or extracting streams natively).
3. Modifying `assets.py` and vectors to support deletion scopes to prevent orphaned Chroma nodes if users want to delete assets.
