import os
from pathlib import Path

# Base directory is the backend folder
BASE_DIR = Path(__file__).resolve().parent.parent

# Storage paths
UPLOAD_DIR = BASE_DIR / "storage" / "originals"
VIOLATION_DIR = BASE_DIR / "storage" / "violations"
DMCA_DIR = BASE_DIR / "storage" / "dmca"
CHROMA_DIR = BASE_DIR / "storage" / "chroma_db"

# Database
DATABASE_URL = f"sqlite:///{BASE_DIR / 'storage' / 'mediashield.db'}"

# Matching thresholds
PHASH_THRESHOLD = 8        # Hamming distance ≤ 8 → HIGH match
CLIP_THRESHOLD = 0.85      # Cosine similarity ≥ 0.85 → match
CLIP_HIGH_THRESHOLD = 0.92 # Cosine ≥ 0.92 → HIGH confidence

# Video matching
VIDEO_FRAMES = 10          # frames to extract when registering a video (and for long scans)
VIDEO_THRESHOLD = 0.70     # average set-similarity ≥ 0.70 → match
VIDEO_HIGH_THRESHOLD = 0.82  # ≥ 0.82 → HIGH confidence

# Short pirated clips (e.g. a few seconds cut from a long master): CLIP scores
# are often lower (re-encode, crop, watermark), and we need more samples/sec.
VIDEO_SHORT_CLIP_MAX_SEC = 10.0
VIDEO_THRESHOLD_SHORT = 0.58
CLIP_THRESHOLD_SHORT = 0.78
VIDEO_HIGH_THRESHOLD_SHORT = 0.72
CLIP_HIGH_THRESHOLD_SHORT = 0.88
# When scanning clips shorter than ~12s, use more frames (capped) — see video_fingerprint
VIDEO_SCAN_SHORT_MAX_FRAMES = 32

# CLIP model
CLIP_MODEL_NAME = "openai/clip-vit-base-patch32"

# Create directories on import
for d in [UPLOAD_DIR, VIOLATION_DIR, DMCA_DIR, CHROMA_DIR]:
    d.mkdir(parents=True, exist_ok=True)
