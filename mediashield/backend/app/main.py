"""
MediaShield API — FastAPI application entry point.
"""

from contextlib import asynccontextmanager
import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import assets, scan, violations, graph, monitoring, webhooks, telegram, insights, twitter
from app.routers import jobs as jobs_router
from app.services.monitoring import monitoring_worker
from app.services.job_worker import job_worker
from app.services.log_config import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    setup_logging()
    init_db()
    monitoring_task = asyncio.create_task(monitoring_worker())
    worker_task = asyncio.create_task(job_worker())
    yield
    worker_task.cancel()
    monitoring_task.cancel()


app = FastAPI(
    title="MediaShield API",
    description="Digital Asset Protection System — detect, track, and enforce ownership of media assets",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(assets.router, prefix="/api")
app.include_router(scan.router, prefix="/api")
app.include_router(violations.router, prefix="/api")
app.include_router(graph.router, prefix="/api")
app.include_router(monitoring.router, prefix="/api")
app.include_router(webhooks.router, prefix="/api")
app.include_router(jobs_router.router, prefix="/api")
app.include_router(telegram.router, prefix="/api")
app.include_router(twitter.router, prefix="/api")
app.include_router(insights.router, prefix="/api/assets", tags=["insights"])
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "MediaShield API"}


@app.get("/api/stats")
async def get_stats():
    """Dashboard stats — quick counts."""
    from app.database import SessionLocal
    from app.models.asset import Asset
    from app.models.violation import Violation

    db = SessionLocal()
    try:
        total_assets = db.query(Asset).count()
        total_violations = db.query(Violation).count()
        high_confidence = db.query(Violation).filter(Violation.match_tier == "HIGH").count()
        return {
            "total_assets": total_assets,
            "total_violations": total_violations,
            "high_confidence_matches": high_confidence,
            "platforms_monitored": db.query(Violation.platform).distinct().count(),
        }
    finally:
        db.close()
