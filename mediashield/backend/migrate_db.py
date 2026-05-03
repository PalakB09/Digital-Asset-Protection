import os
from sqlalchemy import create_engine, inspect, text
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.path.join('storage', 'mediashield.db')
DATABASE_URL = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL") or f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL)
inspector = inspect(engine)

print(f"Connecting to database...")

with engine.connect() as conn:
    tables = inspector.get_table_names()
    print(f"Tables: {tables}")

    if 'violations' in tables:
        columns = [col['name'] for col in inspector.get_columns('violations')]
        print(f"Columns in violations: {columns}")
        
        for col, dtype in [('phash_distance', 'INTEGER'), ('clip_similarity', 'FLOAT'), ('confidence_score', 'FLOAT')]:
            if col not in columns:
                print(f"Adding column {col}...")
                conn.execute(text(f"ALTER TABLE violations ADD COLUMN {col} {dtype}"))
        
        conn.commit()
        print("Schema updated.")
    else:
        print("Error: 'violations' table not found.")
