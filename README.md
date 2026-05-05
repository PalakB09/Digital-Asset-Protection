# MediaShield — Digital Asset Protection System

MediaShield is a production-grade system for detecting, tracking, and enforcing ownership of digital media assets across images and videos. It uses fast visual fingerprinting, CLIP embeddings, watermark verification, background job processing, async event ingestion, and alerting.

## Architecture

```
Next.js Frontend (:3000) <-> FastAPI Backend (:8000)
                                |- SQLite (assets, violations, propagation, job status)
                                |- ChromaDB (image + video frame embeddings)
                                |- Local filesystem (uploads, violations, DMCA PDFs)
                                |- Job Queue (Redis / asyncio.Queue fallback)
                                |- Background Job Worker (async detection pipeline)
                                |- In-memory monitoring queue + dedup cache
                                `- WebSocket alert broadcaster
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLAlchemy, SQLite |
| ML | CLIP (ViT-B/32), imagehash (pHash), DCT watermarking |
| Video Processing | OpenCV, ffmpeg, yt-dlp |
| Vector Search | ChromaDB |
| Job Queue | Redis (Upstash compatible) with asyncio.Queue fallback |
| PDF Generation | fpdf2 |
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Visualization | SVG-based propagation graph |
| Testing | pytest, pytest-asyncio, httpx |

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- ffmpeg installed and available on PATH
- yt-dlp installed and available on PATH
- Redis (optional — system falls back to in-process queue automatically)

### Backend

```bash
cd mediashield/backend

# Create virtual environment
python3 -m venv venv

# Windows
.\venv\Scripts\Activate.ps1
# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browser runtime (required for discovery worker)
python -m playwright install chromium

# Run API (starts background job worker automatically)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

API: `http://localhost:8000`  
Swagger: `http://localhost:8000/docs`

#### Optional: Redis Queue

By default, the job queue uses an in-process `asyncio.Queue`. For production deployments (or Upstash), set:

```bash
export REDIS_URL="redis://localhost:6379"
# or for Upstash:
export REDIS_URL="rediss://default:YOUR_TOKEN@your-endpoint.upstash.io:6379"
```

The system auto-detects and logs: `[QUEUE MODE: REDIS]` or `[QUEUE MODE: LOCAL]`.

### Discovery Worker (Playwright Polling)

This worker periodically scrapes configured pages and pushes discovered post events
to `/api/monitoring/events` automatically.

```bash
cd mediashield/backend

# One-time setup: copy and edit target config
cp workers/discovery_targets.example.json workers/discovery_targets.json

# Optional environment overrides
export MEDIASHIELD_MONITORING_ENDPOINT="http://localhost:8000/api/monitoring/events"
export MEDIASHIELD_POLL_INTERVAL_SEC=15

# Run worker
python workers/playwright_discovery_worker.py
```

Default files used by the worker:
- Targets: `backend/workers/discovery_targets.json`
- Seen-post cache: `backend/workers/.seen_posts.json`

### Frontend

```bash
cd mediashield/frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Dashboard: `http://localhost:3000`

### Running Tests

```bash
cd mediashield/backend
python -m pytest tests/test_pipeline.py -v -s
```

The test suite covers 13 scenarios across 8 categories — see [Test Suite](#test-suite) below.

## Core Features

### 1. Image Asset Registration
- Registers original images with:
    - pHash fingerprint
    - CLIP embedding (512-d vector)
    - Ingestion-time DCT watermark embedding

### 2. Video Asset Registration
- Upload original videos (`/api/assets/video`)
- Uniform stratified frame extraction + CLIP frame embeddings
- Stores frame embeddings in separate video vector collection

### 3. Tiered Detection

Image pipeline:
```
Suspect Image -> L1: pHash -> L2: CLIP -> L3: Watermark Verification
```

Video pipeline:
```
Suspect Video -> Frame extraction -> Video CLIP set similarity + pHash fallback -> Majority voting
```

### 4. Watermark-Based Attribution
- DCT watermark payload stores asset ownership identifier
- If watermark extraction matches the detected asset, violation tier is set to `VERIFIED`

### 5. Background Job Processing
- **Job Queue**: Redis (Upstash compatible) with automatic fallback to `asyncio.Queue`
- **Job Worker**: Continuously processes queued jobs with structured logging:
  ```
  [JOB START] -> [PHASH DONE] -> [CLIP DONE] -> [WATERMARK DONE] -> [JOB END]
  ```
- **Retry logic**: Up to 2 retries on transient failures, then marks job `failed`
- **Crash-proof**: All exceptions caught — worker never stops

### 6. Hybrid Sync/Async URL Scanning
- **Image URLs**: Processed synchronously (fast response)
- **Video URLs**: Auto-fallback to async queue (returns `job_id` for polling)
- **Forced async**: `?async_mode=true` queues any URL scan
- Response formats:
  ```json
  // Synchronous result
  { "status": "completed", "matched": true, "confidence": 0.95 }

  // Async queued
  { "status": "queued", "job_id": "abc-123", "message": "Processing in background" }
  ```

### 7. Deduplication
- SHA-256 hash-based LRU cache with 1-hour TTL
- Prevents re-processing the same URL or media content
- Supports up to 10,000 cached entries

### 8. Monitoring
- In-memory dedup + queue ingestion endpoint (`/api/monitoring/events`)
- Background worker processes queued post/media events

### 9. Propagation Graph + DMCA
- Graph endpoints for spread visualization (supports both image and video assets)
- One-click DMCA generation and download

### 10. Database Status Tracking
- Every violation record includes:
    - `processing_status`: `pending` → `processing` → `done` | `failed`
    - `detection_stage_results`: JSON blob with per-stage diagnostics
    - `confidence` score

## API Endpoints

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/stats` | Dashboard statistics |

### Assets
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/assets` | Register image asset |
| POST | `/api/assets/video` | Register video asset |
| GET | `/api/assets` | List assets |
| GET | `/api/assets/{asset_id}` | Get asset details |
| GET | `/api/assets/{asset_id}/image` | Get asset media (image or video) |

### Scan
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scan` | Scan suspect image (sync) |
| POST | `/api/scan/video` | Scan suspect video (sync) |
| POST | `/api/scan/url` | Scan from URL (sync for images, async for videos) |
| POST | `/api/scan/url?async_mode=true` | Force async scan from URL |

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List recent jobs with status |
| GET | `/api/jobs/{job_id}` | Get job status and result |

### Violations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/violations` | List violations |
| GET | `/api/violations/{violation_id}` | Get violation details |
| GET | `/api/violations/{violation_id}/image` | Get violation media |
| POST | `/api/violations/{violation_id}/dmca` | Generate DMCA PDF |
| GET | `/api/violations/{violation_id}/dmca` | Download DMCA PDF |

### Graph
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/graph` | List graph-enabled assets |
| GET | `/api/graph/{asset_id}` | Get propagation graph |

### Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/monitoring/events` | Ingest discovered post/media event |
| GET | `/api/monitoring/queue` | Queue and dedup stats |

## Test Suite

Run: `python -m pytest tests/test_pipeline.py -v -s`

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | Job Creation | `?async_mode=true` creates a job in the queue with `status=pending` |
| 2A | Same Image Match | Identical image scan produces high-confidence match |
| 2B | Modified Image Match | Resized/compressed image still detected (confidence > 0.5) |
| 2C | Different Image | Distinct pattern image properly evaluated |
| 3 | Video Pipeline | Video URL auto-fallback to async queue + job status polling |
| 4 | Deduplication | Same URL scanned twice — second is deduplicated |
| 5 | DB Status | Violation record has `processing_status=done` after scan |
| 6A | Invalid File | Non-image upload rejected with 400 |
| 6B | Broken Image | Corrupted JPEG rejected with 400 |
| 6C | Empty Input | Empty file rejected with 400 |
| 6D | Worker Recovery | Invalid job marked `failed`, worker continues |
| 7 | Queue Stability | 5 rapid-fire jobs all queued without crash |
| 8 | End-to-End | Full pipeline: register → scan → violation → API query → jobs list |

## Project Structure

```
mediashield/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI entry point + lifespan
│   │   ├── config.py                  # Thresholds, paths, model names
│   │   ├── database.py                # SQLAlchemy + safe migrations
│   │   ├── models/
│   │   │   ├── asset.py               # Asset model (image/video)
│   │   │   └── violation.py           # Violation + PropagationEdge models
│   │   ├── routers/
│   │   │   ├── assets.py              # Asset CRUD + registration
│   │   │   ├── scan.py                # Image/video/URL scan (sync+async)
│   │   │   ├── violations.py          # Violation CRUD + DMCA
│   │   │   ├── graph.py               # Propagation graph data
│   │   │   ├── monitoring.py          # Event ingestion endpoint
│   │   │   ├── webhooks.py            # YouTube WebSub
│   │   │   └── jobs.py                # Job status polling
│   │   └── services/
│   │       ├── fingerprint.py         # pHash + CLIP embedding
│   │       ├── matcher.py             # Tiered matching pipeline
│   │       ├── scanner.py             # Full image scan + violation creation
│   │       ├── watermark.py           # DCT watermark embed/extract
│   │       ├── video_fingerprint.py   # Frame extraction + video CLIP
│   │       ├── video_matcher.py       # Video set-similarity matching
│   │       ├── vector_store.py        # ChromaDB wrapper
│   │       ├── job_queue.py           # Redis / asyncio.Queue job queue
│   │       ├── job_worker.py          # Background job processor
│   │       ├── dedup.py               # URL/media deduplication cache
│   │       ├── log_config.py          # Structured logging setup
│   │       ├── monitoring.py          # Monitoring background worker
│   │       ├── alerts.py              # WebSocket alert broadcaster
│   │       ├── graph_service.py       # Propagation graph builder
│   │       └── dmca.py                # DMCA PDF generator
│   ├── tests/
│   │   ├── conftest.py                # Pytest configuration
│   │   └── test_pipeline.py           # 13-test validation suite
│   ├── workers/
│   │   └── playwright_discovery_worker.py
│   ├── requirements.txt
│   └── pytest.ini
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── assets/                # Asset dashboard (image + video)
│       │   ├── scan/                  # Scan page (URL + file upload)
│       │   ├── violations/            # Violation list + media viewer
│       │   └── graph/                 # Propagation graph visualization
│       └── lib/
│           └── api.ts                 # API client (sync + async + jobs)
└── README.md
```
