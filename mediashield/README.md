# MediaShield — Digital Asset Protection System

MediaShield is an MVP for detecting, tracking, and enforcing ownership of digital media assets across images and videos. It uses fast visual fingerprinting, CLIP embeddings, watermark verification, near real-time event ingestion, and instant alerting.

## Architecture

```
Next.js Frontend (:3000) <-> FastAPI Backend (:8000)
                                                            |- SQLite (assets, violations, propagation)
                                                            |- ChromaDB (image + video frame embeddings)
                                                            |- Local filesystem (uploads, violations, DMCA PDFs)
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
| PDF Generation | fpdf2 |
| Frontend | Next.js 16, React 19, Tailwind CSS |
| Visualization | SVG-based propagation graph |

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- ffmpeg installed and available on PATH
- yt-dlp installed and available on PATH

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

# Run API
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

API: `http://localhost:8000`
Swagger: `http://localhost:8000/docs`

### Frontend

```bash
cd mediashield/frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Dashboard: `http://localhost:3000`

## Core Features

### 1. Image Asset Registration
- Registers original images with:
    - pHash
    - CLIP embedding
    - ingestion-time DCT watermark embedding

### 2. Video Asset Registration
- Upload original videos (`/api/assets/video`)
- Uniform frame extraction + CLIP frame embeddings
- Stores frame embeddings in separate video vector collection

### 3. Tiered Detection

Image pipeline:
```
Suspect Image -> L1: pHash -> L2: CLIP -> L3: Watermark Verification
```

Video pipeline:
```
Suspect Video -> Frame extraction -> Video CLIP set similarity + pHash fallback
```

### 4. Watermark-Based Attribution
- DCT watermark payload stores asset ownership identifier
- If watermark extraction matches the detected asset, violation tier is set to `VERIFIED`

### 5. Near Real-Time Monitoring
- In-memory dedup + queue ingestion endpoint (`/api/monitoring/events`)
- Background worker processes queued post/media events

### 6. Real-Time Alerts
- WebSocket endpoint (`/api/scan/ws/alerts`) pushes violation alerts instantly to connected clients

### 7. YouTube WebSub Webhook Support
- Verification + push notification handling:
    - `GET /api/webhooks/youtube`
    - `POST /api/webhooks/youtube`

### 8. Propagation Graph + DMCA
- Graph endpoints for spread visualization
- One-click DMCA generation and download

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
| GET | `/api/assets/{asset_id}/image` | Get asset image |

### Scan
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scan` | Scan suspect image |
| POST | `/api/scan/video` | Scan suspect video |
| WS | `/api/scan/ws/alerts` | Real-time violation alerts |

### Violations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/violations` | List violations |
| GET | `/api/violations/{violation_id}` | Get violation details |
| GET | `/api/violations/{violation_id}/image` | Get violation media image |
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

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/webhooks/youtube` | WebSub challenge response |
| POST | `/api/webhooks/youtube` | YouTube upload push ingestion |

## Project Structure

```
mediashield/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   │   ├── asset.py
│   │   │   └── violation.py
│   │   ├── routers/
│   │   │   ├── assets.py
│   │   │   ├── scan.py
│   │   │   ├── violations.py
│   │   │   ├── graph.py
│   │   │   ├── monitoring.py
│   │   │   └── webhooks.py
│   │   └── services/
│   │       ├── fingerprint.py
│   │       ├── matcher.py
│   │       ├── scanner.py
│   │       ├── watermark.py
│   │       ├── video_fingerprint.py
│   │       ├── video_matcher.py
│   │       ├── vector_store.py
│   │       ├── monitoring.py
│   │       ├── alerts.py
│   │       ├── graph_service.py
│   │       └── dmca.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── assets/
│       │   ├── scan/
│       │   ├── violations/
│       │   └── graph/
│       └── lib/
│           └── api.ts
└── README.md
```
