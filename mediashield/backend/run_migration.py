# run_migration.py  — place in backend/ and run once with: python run_migration.py

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "storage", "mediashield.db")

MIGRATIONS = [
    # New insight/signal columns on violations
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

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Fetch existing columns so we skip any already present
cursor.execute("PRAGMA table_info(violations)")
existing = {row[1] for row in cursor.fetchall()}
print(f"Existing columns: {existing}")

for stmt in MIGRATIONS:
    col = stmt.split("ADD COLUMN")[1].strip().split()[0]
    if col in existing:
        print(f"  SKIP  {col} (already exists)")
    else:
        cursor.execute(stmt)
        print(f"  ADD   {col}")

conn.commit()
conn.close()
print("\nMigration complete.")