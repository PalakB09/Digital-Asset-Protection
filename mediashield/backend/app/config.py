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

# CLIP model
CLIP_MODEL_NAME = "openai/clip-vit-base-patch32"

# Create directories on import
for d in [UPLOAD_DIR, VIOLATION_DIR, DMCA_DIR, CHROMA_DIR]:
    d.mkdir(parents=True, exist_ok=True)
