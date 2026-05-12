import os
import sys

DB_URL = os.environ.get("DATABASE_URL", "")

if DB_URL and not DB_URL.startswith("sqlite"):
    from database import engine, Base
    import models
    from sqlalchemy import text

    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        columns = [
            ("website", "TEXT"),
            ("email_primary", "TEXT"),
            ("email_additional", "TEXT"),
            ("phone", "TEXT"),
            ("address", "TEXT"),
            ("personnel_data", "TEXT"),
            ("priority", "TEXT"),
            ("lead_source", "TEXT DEFAULT 'manual'"),
        ]
        for col_name, col_type in columns:
            try:
                conn.execute(text(f"ALTER TABLE leads ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass
    print("PostgreSQL migration complete.")
else:
    import sqlite3

    db_path = os.path.join(os.path.dirname(__file__), "crm.db")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    columns = [
        ("website", "TEXT"),
        ("email_primary", "TEXT"),
        ("email_additional", "TEXT"),
        ("phone", "TEXT"),
        ("address", "TEXT"),
        ("personnel_data", "TEXT"),
        ("priority", "TEXT"),
        ("lead_source", "TEXT DEFAULT 'manual'"),
    ]

    for col_name, col_type in columns:
        try:
            cursor.execute(f"ALTER TABLE leads ADD COLUMN {col_name} {col_type}")
            print(f"  Added column '{col_name}'")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"  Column '{col_name}' already exists, skipping.")
            else:
                print(f"  Skipping '{col_name}': {e}")

    conn.commit()
    conn.close()
    print("SQLite migration complete.")
