from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite needs this
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
    """Create all tables. Called at app startup."""
    from app.models.asset import Asset  # noqa: F401
    from app.models.violation import Violation, PropagationEdge  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _run_sqlite_migrations()


def _run_sqlite_migrations():
    """Best-effort additive migrations for local SQLite development."""
    if not DATABASE_URL.startswith("sqlite:///"):
        return

    with engine.connect() as conn:
        asset_cols = _table_columns(conn, "assets")
        if "watermark_key" not in asset_cols:
            conn.exec_driver_sql("ALTER TABLE assets ADD COLUMN watermark_key VARCHAR")

        violation_cols = _table_columns(conn, "violations")
        if "watermark_verified" not in violation_cols:
            conn.exec_driver_sql("ALTER TABLE violations ADD COLUMN watermark_verified BOOLEAN DEFAULT 0")
        if "attribution" not in violation_cols:
            conn.exec_driver_sql("ALTER TABLE violations ADD COLUMN attribution VARCHAR")


def _table_columns(conn, table_name: str) -> set[str]:
    rows = conn.exec_driver_sql(f"PRAGMA table_info({table_name})").fetchall()
    return {row[1] for row in rows}
