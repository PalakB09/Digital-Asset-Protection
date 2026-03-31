"""
Job queue — async-aware queue with optional Redis backend.

Provides a unified interface: push/pop/status.  If REDIS_URL is configured
and the redis package is importable the queue persists to Redis lists;
otherwise an in-process asyncio.Queue is used.
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Job schema
# ---------------------------------------------------------------------------

@dataclass
class Job:
    id: str = field(default_factory=lambda: str(uuid4()))
    job_type: str = ""            # scan_image, scan_video, scan_url
    payload: dict = field(default_factory=dict)
    status: str = "pending"       # pending, processing, done, failed
    result: Optional[dict] = None
    error: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    started_at: Optional[str] = None
    finished_at: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, data: str) -> "Job":
        d = json.loads(data)
        return cls(**d)


# ---------------------------------------------------------------------------
# Redis helpers
# ---------------------------------------------------------------------------
_REDIS_URL = os.environ.get("REDIS_URL", "")
_redis_client = None
_REDIS_QUEUE_KEY = "mediashield:job_queue"
_REDIS_JOB_PREFIX = "mediashield:job:"


def _try_redis():
    """Best-effort Redis connection; returns None on failure."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    if not _REDIS_URL:
        return None
    try:
        import redis as _redis_mod
        _redis_client = _redis_mod.from_url(_REDIS_URL, decode_responses=True)
        _redis_client.ping()
        log.info("[QUEUE MODE: REDIS] Connected to %s", _REDIS_URL[:30])
        return _redis_client
    except Exception as e:
        log.warning("[QUEUE] Redis unavailable (%s), falling back to local queue", e)
        _redis_client = None
        return None


# ---------------------------------------------------------------------------
# Queue implementation
# ---------------------------------------------------------------------------
class JobQueue:
    """Async job queue with Redis + local fallback."""

    def __init__(self):
        self._local_queue: asyncio.Queue[Job] = asyncio.Queue()
        self._jobs: dict[str, Job] = {}  # in-memory job store (used by both modes)
        self._redis = _try_redis()
        mode = "REDIS" if self._redis else "LOCAL"
        log.info("[QUEUE MODE: %s]", mode)

    @property
    def using_redis(self) -> bool:
        return self._redis is not None

    # ── Push ────────────────────────────────────────────────────
    async def push(self, job: Job) -> str:
        self._jobs[job.id] = job
        if self._redis:
            self._redis.set(f"{_REDIS_JOB_PREFIX}{job.id}", job.to_json(), ex=86400)
            self._redis.lpush(_REDIS_QUEUE_KEY, job.id)
        else:
            await self._local_queue.put(job)
        log.info("[QUEUE] Job pushed: id=%s type=%s", job.id, job.job_type)
        return job.id

    # ── Pop (blocking) ──────────────────────────────────────────
    async def pop(self, timeout: float = 1.0) -> Optional[Job]:
        if self._redis:
            # blpop but wrapped for async compat
            result = await asyncio.get_event_loop().run_in_executor(
                None, lambda: self._redis.brpop(_REDIS_QUEUE_KEY, timeout=int(timeout))
            )
            if result is None:
                return None
            _, job_id = result
            raw = self._redis.get(f"{_REDIS_JOB_PREFIX}{job_id}")
            if raw:
                job = Job.from_json(raw)
                self._jobs[job.id] = job
                return job
            return None
        else:
            try:
                job = await asyncio.wait_for(self._local_queue.get(), timeout=timeout)
                return job
            except asyncio.TimeoutError:
                return None

    # ── Status ──────────────────────────────────────────────────
    def update_job(self, job: Job):
        self._jobs[job.id] = job
        if self._redis:
            self._redis.set(f"{_REDIS_JOB_PREFIX}{job.id}", job.to_json(), ex=86400)

    def get_job(self, job_id: str) -> Optional[Job]:
        if job_id in self._jobs:
            return self._jobs[job_id]
        if self._redis:
            raw = self._redis.get(f"{_REDIS_JOB_PREFIX}{job_id}")
            if raw:
                job = Job.from_json(raw)
                self._jobs[job.id] = job
                return job
        return None

    def list_jobs(self, limit: int = 50) -> list[dict]:
        jobs = sorted(self._jobs.values(), key=lambda j: j.created_at, reverse=True)
        return [j.to_dict() for j in jobs[:limit]]


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
_queue: Optional[JobQueue] = None


def get_queue() -> JobQueue:
    global _queue
    if _queue is None:
        _queue = JobQueue()
    return _queue
