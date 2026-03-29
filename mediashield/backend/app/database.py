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
    """Create all tables and run column migrations. Called at app startup."""
    from app.models.asset import Asset  # noqa: F401
    from app.models.violation import Violation, PropagationEdge  # noqa: F401
    Base.metadata.create_all(bind=engine)
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
