import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory is the backend folder
BASE_DIR = Path(__file__).resolve().parent.parent

# Load only backend/.env (source of truth for GEMINI_API_KEY)
_env_path = BASE_DIR / ".env"
if _env_path.is_file():
    load_dotenv(_env_path, override=True)

# Storage paths
UPLOAD_DIR = BASE_DIR / "storage" / "originals"
VIOLATION_DIR = BASE_DIR / "storage" / "violations"
DMCA_DIR = BASE_DIR / "storage" / "dmca"
DISTRIBUTIONS_DIR = BASE_DIR / "storage" / "distributions"
CHROMA_DIR = BASE_DIR / "storage" / "chroma_db"
TELEGRAM_DIR = BASE_DIR / "storage" / "telegram"

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

# Gemini (keywords)
GEMINI_API_KEY = (os.environ.get("GEMINI_API_KEY", "") or "").strip().lstrip("\ufeff").strip('"').strip("'")
# Default Gemini model for keyword generation (code-defined; not from .env)
GEMINI_MODEL = "models/gemini-2.5-flash-lite"


def _int_env(name: str, default: int = 0) -> int:
    v = (os.environ.get(name, "") or "").strip()
    if not v:
        return default
    try:
        return int(v)
    except ValueError:
        return default

# YouTube Data API
YOUTUBE_API_KEY = (os.environ.get("YOUTUBE_API_KEY", "") or "").strip()

# Google Custom Search API (official, no CAPTCHA/429 issues)
# Get these from: https://programmablesearchengine.google.com + Google Cloud Console
GOOGLE_CSE_API_KEY = (os.environ.get("GOOGLE_CSE_API_KEY", "") or os.environ.get("YOUTUBE_API_KEY", "") or "").strip()
GOOGLE_CSE_CX = (os.environ.get("GOOGLE_CSE_CX", "") or "").strip()

# Hybrid Matcher Parameters
HYBRID_SCORE_THRESHOLD = 0.75
TEXT_WEIGHT = 0.4
HASH_WEIGHT = 0.6


# Telegram (Telethon — user account; see scripts/telegram_login.py and TELEGRAM_SETUP.md)
TELEGRAM_API_ID = _int_env("TELEGRAM_API_ID", 0)
TELEGRAM_API_HASH = (os.environ.get("TELEGRAM_API_HASH", "") or "").strip()
TELEGRAM_PHONE = (os.environ.get("TELEGRAM_PHONE", "") or "").strip()
TELEGRAM_SESSION_NAME = (os.environ.get("TELEGRAM_SESSION_NAME", "mediashield") or "mediashield").strip()
# Telethon expects session path WITHOUT the .session suffix
TELEGRAM_SESSION_PATH = TELEGRAM_DIR / TELEGRAM_SESSION_NAME
TELEGRAM_MAX_DOWNLOAD_MB = _int_env("TELEGRAM_MAX_DOWNLOAD_MB", 50) or 50

# X / Twitter scraping (Playwright + public web pages)
X_MAX_DOWNLOAD_MB = _int_env("X_MAX_DOWNLOAD_MB", 50) or 50


def telegram_configured() -> bool:
    return TELEGRAM_API_ID > 0 and bool(TELEGRAM_API_HASH)


# Create directories on import
for d in [UPLOAD_DIR, VIOLATION_DIR, DMCA_DIR, CHROMA_DIR, TELEGRAM_DIR, DISTRIBUTIONS_DIR]:
    d.mkdir(parents=True, exist_ok=True)
