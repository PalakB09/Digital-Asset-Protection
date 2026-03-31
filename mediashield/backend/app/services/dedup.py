"""
Deduplication service — prevents re-processing the same media.

Uses an in-memory LRU cache with TTL. For the current single-process MVP this
is sufficient; a Redis SET can replace it for multi-worker deployments.
"""

import hashlib
import time
import threading
import logging

log = logging.getLogger(__name__)

_MAX_SIZE = 10_000
_TTL_SECONDS = 3600  # 1 hour


class _DedupCache:
    """Thread-safe TTL LRU dedup cache."""

    def __init__(self, max_size: int = _MAX_SIZE, ttl: int = _TTL_SECONDS):
        self._cache: dict[str, float] = {}  # key -> expiry timestamp
        self._lock = threading.Lock()
        self._max = max_size
        self._ttl = ttl

    def _evict(self):
        now = time.time()
        expired = [k for k, exp in self._cache.items() if exp <= now]
        for k in expired:
            del self._cache[k]
        # If still over capacity, drop oldest entries
        while len(self._cache) > self._max:
            oldest = min(self._cache, key=self._cache.get)  # type: ignore
            del self._cache[oldest]

    def is_duplicate(self, key: str) -> bool:
        with self._lock:
            self._evict()
            if key in self._cache and self._cache[key] > time.time():
                log.info("[DEDUP] Duplicate detected: %s", key[:16])
                return True
            return False

    def mark_seen(self, key: str):
        with self._lock:
            self._cache[key] = time.time() + self._ttl
            self._evict()

    def clear(self):
        with self._lock:
            self._cache.clear()


# Module-level singleton
_cache = _DedupCache()


def hash_bytes(data: bytes) -> str:
    """SHA-256 hash of raw bytes."""
    return hashlib.sha256(data).hexdigest()


def hash_url(url: str) -> str:
    """SHA-256 hash of a normalized URL."""
    return hashlib.sha256(url.strip().lower().encode()).hexdigest()


def is_duplicate(key: str) -> bool:
    return _cache.is_duplicate(key)


def mark_seen(key: str):
    _cache.mark_seen(key)


def clear():
    _cache.clear()
