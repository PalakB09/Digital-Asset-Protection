# run_migration.py  — place in backend/ and run once with: python run_migration.py

import os
from sqlalchemy import create_engine, inspect, text
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.path.join(os.path.dirname(__file__), "storage", "mediashield.db")
DATABASE_URL = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL") or f"sqlite:///{DB_PATH}"

MIGRATIONS = [
    "ALTER TABLE violations ADD COLUMN phash_distance INTEGER",
    "ALTER TABLE violations ADD COLUMN clip_similarity REAL",
    "ALTER TABLE violations ADD COLUMN confidence_score REAL",
    "ALTER TABLE violations ADD COLUMN views INTEGER DEFAULT 0",
    "ALTER TABLE violations ADD COLUMN likes INTEGER DEFAULT 0",
    "ALTER TABLE violations ADD COLUMN threat_score REAL DEFAULT 0.0",
    "ALTER TABLE violations ADD COLUMN ssim_score REAL",
    "ALTER TABLE violations ADD COLUMN scraped_text TEXT",
    "ALTER TABLE violations ADD COLUMN detection_stage_results TEXT",
    "ALTER TABLE violations ADD COLUMN attribution TEXT",
    "ALTER TABLE violations ADD COLUMN processing_status TEXT DEFAULT 'done'",
    "ALTER TABLE violations ADD COLUMN leaked_by TEXT",
]

engine = create_engine(DATABASE_URL)
inspector = inspect(engine)

print(f"Connecting to database...")

with engine.connect() as conn:
    if inspector.has_table("violations"):
        existing = {col["name"] for col in inspector.get_columns("violations")}
        print(f"Existing columns: {existing}")

        for stmt in MIGRATIONS:
            col = stmt.split("ADD COLUMN")[1].strip().split()[0]
            if col in existing:
                print(f"  SKIP  {col} (already exists)")
            else:
                conn.execute(text(stmt))
                print(f"  ADD   {col}")
        
        conn.commit()
    else:
        print("Error: 'violations' table not found.")

print("\nMigration complete.")