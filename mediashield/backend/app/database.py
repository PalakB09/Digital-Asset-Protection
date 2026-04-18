from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import DATABASE_URL

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session, closes on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables and run column migrations. Called at app startup."""
    from app.models.asset import Asset, AssetRecipient, AssetDistribution  # noqa: F401
    from app.models.violation import Violation, PropagationEdge  # noqa: F401
    from app.models.telegram import MonitoredChannel  # noqa: F401
    from app.models.job import JobRecord  # noqa: F401
    Base.metadata.create_all(bind=engine)
    if DATABASE_URL.startswith("sqlite"):
        _migrate()


def _migrate():
    """Add new columns to existing tables if they don't exist yet."""
    with engine.connect() as conn:
        existing = {row[1] for row in conn.execute(
            __import__("sqlalchemy").text("PRAGMA table_info(assets)")
        )}
        if "asset_type" not in existing:
            conn.execute(__import__("sqlalchemy").text(
                "ALTER TABLE assets ADD COLUMN asset_type VARCHAR DEFAULT 'image'"
            ))
        if "frame_count" not in existing:
            conn.execute(__import__("sqlalchemy").text(
                "ALTER TABLE assets ADD COLUMN frame_count INTEGER"
            ))
        conn.commit()
    _run_sqlite_migrations()


def _run_sqlite_migrations():
    """Best-effort additive migrations for local SQLite development."""
    if not DATABASE_URL.startswith("sqlite:///"):
        return

    with engine.connect() as conn:
        asset_cols = _table_columns(conn, "assets")
        if "watermark_key" not in asset_cols:
            conn.exec_driver_sql("ALTER TABLE assets ADD COLUMN watermark_key VARCHAR")
        if "keywords" not in asset_cols:
            conn.exec_driver_sql("ALTER TABLE assets ADD COLUMN keywords TEXT")
        if "description" not in asset_cols:
            conn.exec_driver_sql("ALTER TABLE assets ADD COLUMN description TEXT")

        violation_cols = _table_columns(conn, "violations")
        if "watermark_verified" not in violation_cols:
            conn.exec_driver_sql("ALTER TABLE violations ADD COLUMN watermark_verified BOOLEAN DEFAULT 0")
        if "attribution" not in violation_cols:
            conn.exec_driver_sql("ALTER TABLE violations ADD COLUMN attribution VARCHAR")
        if "processing_status" not in violation_cols:
            conn.exec_driver_sql("ALTER TABLE violations ADD COLUMN processing_status VARCHAR DEFAULT 'done'")
        if "detection_stage_results" not in violation_cols:
            conn.exec_driver_sql("ALTER TABLE violations ADD COLUMN detection_stage_results TEXT")
        if "leaked_by" not in violation_cols:
            conn.exec_driver_sql("ALTER TABLE violations ADD COLUMN leaked_by VARCHAR")
        # Insights & AI columns
        if "views" not in violation_cols:
            conn.exec_driver_sql("ALTER TABLE violations ADD COLUMN views INTEGER DEFAULT 0")
        if "likes" not in violation_cols:
            conn.exec_driver_sql("ALTER TABLE violations ADD COLUMN likes INTEGER DEFAULT 0")
        if "threat_score" not in violation_cols:
            conn.exec_driver_sql("ALTER TABLE violations ADD COLUMN threat_score FLOAT DEFAULT 0.0")
        if "ssim_score" not in violation_cols:
            conn.exec_driver_sql("ALTER TABLE violations ADD COLUMN ssim_score FLOAT")
        if "scraped_text" not in violation_cols:
            conn.exec_driver_sql("ALTER TABLE violations ADD COLUMN scraped_text TEXT")
        if "phash_distance" not in violation_cols:
            conn.exec_driver_sql("ALTER TABLE violations ADD COLUMN phash_distance INTEGER")
        if "clip_similarity" not in violation_cols:
            conn.exec_driver_sql("ALTER TABLE violations ADD COLUMN clip_similarity FLOAT")
        if "confidence_score" not in violation_cols:
            conn.exec_driver_sql("ALTER TABLE violations ADD COLUMN confidence_score FLOAT")

        edge_cols = _table_columns(conn, "propagation_edges")
        if "leaked_by" not in edge_cols:
            conn.exec_driver_sql("ALTER TABLE propagation_edges ADD COLUMN leaked_by VARCHAR")
        if "watermark_id" not in edge_cols:
            conn.exec_driver_sql("ALTER TABLE propagation_edges ADD COLUMN watermark_id VARCHAR")


def _table_columns(conn, table_name: str) -> set[str]:
    rows = conn.exec_driver_sql(f"PRAGMA table_info({table_name})").fetchall()
    return {row[1] for row in rows}
