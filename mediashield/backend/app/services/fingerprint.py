"""
Fingerprint service — generates pHash and CLIP embeddings for images.
"""

import imagehash
import numpy as np
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
from app.config import CLIP_MODEL_NAME

# ---------------------------------------------------------------------------
# CLIP model singleton — loaded once, reused across requests
# ---------------------------------------------------------------------------
_clip_model = None
_clip_processor = None


def _get_clip():
    """Lazy-load CLIP model and processor."""
    global _clip_model, _clip_processor
    if _clip_model is None:
        _clip_model = CLIPModel.from_pretrained(CLIP_MODEL_NAME)
        _clip_processor = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
        _clip_model.eval()
    return _clip_model, _clip_processor


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_phash(image: Image.Image) -> str:
    """
    Compute perceptual hash of an image.
    Returns hex string representation of a 64-bit pHash.
    """
    h = imagehash.phash(image, hash_size=8)
    return str(h)


def compute_embedding(image: Image.Image) -> list[float]:
    """
    Compute CLIP embedding for an image.
    Returns a normalized 512-d vector as a list of floats.
    """
    model, processor = _get_clip()

    # Preprocess
    inputs = processor(images=image, return_tensors="pt")

    # Forward pass (no gradient needed)
    with torch.no_grad():
        outputs = model.get_image_features(**inputs)

    # Normalize to unit vector (for cosine similarity)
    embedding = outputs[0]
    embedding = embedding / embedding.norm()

    return embedding.cpu().numpy().flatten().tolist()


def hamming_distance(hash1: str, hash2: str) -> int:
    """
    Compute Hamming distance between two hex hash strings.
    """
    h1 = imagehash.hex_to_hash(hash1)
    h2 = imagehash.hex_to_hash(hash2)
    return int(h1 - h2)


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """
    Compute cosine similarity between two vectors.
    """
    a = np.array(vec1)
    b = np.array(vec2)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
