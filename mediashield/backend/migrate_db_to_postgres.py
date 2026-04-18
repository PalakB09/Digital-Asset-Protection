import os
import sys
import json
from pathlib import Path
from sqlalchemy import create_engine, MetaData
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Load .env
_env_path = BASE_DIR / ".env"
if _env_path.is_file():
    load_dotenv(_env_path, override=True)

SQLITE_URL = f"sqlite:///{BASE_DIR / 'storage' / 'mediashield.db'}"
POSTGRES_URL = (os.environ.get("POSTGRES_URL") or "").strip()

if not POSTGRES_URL:
    print("No POSTGRES_URL found in environment!")
    sys.exit(1)

print(f"Source: {SQLITE_URL}")
print(f"Target: {POSTGRES_URL}")

# Initialize Postgres DB Schema
print("Initializing Postgres schema...")
os.environ["DATABASE_URL"] = POSTGRES_URL # Force app to use Postgres
from app.database import init_db
init_db()

# Create engines
sqlite_engine = create_engine(SQLITE_URL)
pg_engine = create_engine(POSTGRES_URL)

sqlite_meta = MetaData()
sqlite_meta.reflect(bind=sqlite_engine)

pg_meta = MetaData()
pg_meta.reflect(bind=pg_engine)

def migrate():
    with sqlite_engine.connect() as sqlite_conn:
        with pg_engine.connect() as pg_conn:
            with pg_conn.begin():
                for table in sqlite_meta.sorted_tables:
                    print(f"--- Migrating table {table.name} ---")
                    
                    if table.name not in pg_meta.tables:
                        print(f"Warning: Table {table.name} not found in Postgres! Skipping.")
                        continue
                    
                    pg_table = pg_meta.tables[table.name]
                    
                    rows = sqlite_conn.execute(table.select()).fetchall()
                    print(f"  Found {len(rows)} rows.")
                    
                    if not rows:
                        continue
                        
                    insert_data = []
                    for row in rows:
                        row_dict = {}
                        for col_name in row._mapping.keys():
                            if col_name in pg_table.columns:
                                val = row._mapping[col_name]
                                # SQLite sometimes uses 1/0 for booleans, Postgres requires True/False
                                # SQLAlchemy usually handles this, but since we use Core it might pass the int directly
                                pg_col_type = pg_table.columns[col_name].type.python_type
                                if pg_col_type is bool and type(val) is int:
                                    val = bool(val)
                                row_dict[col_name] = val
                        insert_data.append(row_dict)
                    
                    try:
                        pg_conn.execute(pg_table.insert(), insert_data)
                        print(f"  Successfully migrated {len(insert_data)} rows into {table.name}.")
                    except Exception as e:
                        print(f"  Error migrating table {table.name}: {e}")
                        raise e

if __name__ == "__main__":
    migrate()
    print("Migration completed successfully!")
