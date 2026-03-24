# MediaShield — Digital Asset Protection System

A production-quality MVP for detecting, tracking, and enforcing ownership of digital media assets. Features perceptual hashing (pHash), CLIP embedding matching, propagation graph visualization, and automated DMCA report generation.

## Architecture

```
Next.js Frontend (:3000) ←→ FastAPI Backend (:8000)
                              ├── SQLite (assets, violations)
                              ├── ChromaDB (CLIP embeddings)
                              └── Local filesystem (images, PDFs)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLAlchemy, SQLite |
| ML | CLIP (ViT-B/32), imagehash (pHash) |
| Vector Search | ChromaDB |
| PDF Generation | fpdf2 |
| Frontend | Next.js 15, Tailwind CSS |
| Visualization | SVG-based propagation graph |

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend

```bash
cd mediashield/backend

# Create virtual environment
python -m venv venv

# Windows
.\venv\Scripts\Activate.ps1
# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`
Swagger UI: `http://localhost:8000/docs`

### Frontend

```bash
cd mediashield/frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Dashboard: `http://localhost:3000`

## Features

### 1. Asset Registration
Upload original images to generate dual fingerprints:
- **pHash**: Perceptual hash for fast near-exact matching
- **CLIP embedding**: 512-d vector for transformation-resilient matching

### 2. Violation Detection (Tiered Pipeline)
```
Suspect Image → L1: pHash (Hamming ≤ 8) → L2: CLIP (cosine ≥ 0.85)
```
- **L1 pHash**: Sub-millisecond, catches near-exact copies (HIGH confidence)
- **L2 CLIP**: Catches crops, filters, compression (MEDIUM/HIGH confidence)

### 3. Propagation Graph
Interactive SVG graph showing how content spreads across platforms with:
- Radial layout with original at center
- Confidence-labeled edges
- Hover tooltips with match details

### 4. DMCA Generator
One-click PDF generation with:
- Original and infringing images
- Similarity score and match method
- Legal declaration template

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/assets` | Register an original image |
| GET | `/api/assets` | List all assets |
| GET | `/api/assets/{id}/image` | Get asset image |
| POST | `/api/scan` | Scan suspect image |
| GET | `/api/violations` | List violations |
| POST | `/api/violations/{id}/dmca` | Generate DMCA PDF |
| GET | `/api/violations/{id}/dmca` | Download DMCA PDF |
| GET | `/api/graph/{id}` | Get propagation graph |
| GET | `/api/stats` | Dashboard statistics |

## Project Structure

```
mediashield/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI entry point
│   │   ├── config.py          # Settings and paths
│   │   ├── database.py        # SQLAlchemy setup
│   │   ├── models/
│   │   │   ├── asset.py       # Asset model
│   │   │   └── violation.py   # Violation + PropagationEdge
│   │   ├── services/
│   │   │   ├── fingerprint.py # pHash + CLIP
│   │   │   ├── vector_store.py# ChromaDB wrapper
│   │   │   ├── matcher.py     # Tiered matching pipeline
│   │   │   ├── scanner.py     # Scan orchestration
│   │   │   ├── graph_service.py # Propagation graph
│   │   │   └── dmca.py        # PDF generation
│   │   └── routers/
│   │       ├── assets.py
│   │       ├── scan.py
│   │       ├── violations.py
│   │       └── graph.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── layout.tsx     # Root layout + sidebar
│       │   ├── page.tsx       # Dashboard
│       │   ├── assets/        # Asset registry
│       │   ├── scan/          # Violation scanner
│       │   ├── violations/    # Violation list
│       │   └── graph/         # Propagation graph
│       └── lib/
│           └── api.ts         # API client
└── README.md
```
