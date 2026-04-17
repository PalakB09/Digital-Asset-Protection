import sqlite3
import os

db_path = os.path.join('storage', 'mediashield.db')
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found.")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# List tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [t[0] for t in cursor.fetchall()]
print(f"Tables: {tables}")

# Check violations table columns
if 'violations' in tables:
    cursor.execute("PRAGMA table_info(violations)")
    columns = [row[1] for row in cursor.fetchall()]
    print(f"Columns in violations: {columns}")
    
    # Add missing columns
    for col, dtype in [('phash_distance', 'INTEGER'), ('clip_similarity', 'FLOAT'), ('confidence_score', 'FLOAT')]:
        if col not in columns:
            print(f"Adding column {col}...")
            cursor.execute(f"ALTER TABLE violations ADD COLUMN {col} {dtype}")
    
    conn.commit()
    print("Schema updated.")
else:
    print("Error: 'violations' table not found.")

conn.close()
