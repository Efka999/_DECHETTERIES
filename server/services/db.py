"""
SQLite database utilities for raw collectes data.
"""

import sqlite3
from pathlib import Path


def get_db_path():
    base_dir = Path(__file__).resolve().parents[1]
    return base_dir / "data" / "collectes.db"


def ensure_db_dir():
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path


def get_connection():
    db_path = ensure_db_dir()
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS import_files (
                id INTEGER PRIMARY KEY,
                filename TEXT NOT NULL,
                file_hash TEXT UNIQUE,
                imported_at TEXT NOT NULL,
                row_count INTEGER,
                sheet_count INTEGER
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS raw_collectes (
                id INTEGER PRIMARY KEY,
                file_id INTEGER NOT NULL REFERENCES import_files(id),
                row_index INTEGER,
                date TEXT NOT NULL,
                date_raw TEXT,
                lieu_collecte TEXT NOT NULL,
                categorie TEXT NOT NULL,
                sous_categorie TEXT,
                flux TEXT NOT NULL,
                orientation TEXT,
                poids REAL NOT NULL,
                source_file TEXT,
                source_sheet TEXT
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS dim_dechetterie (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                source_key TEXT UNIQUE
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS dim_category (
                id INTEGER PRIMARY KEY,
                categorie TEXT NOT NULL,
                sous_categorie TEXT,
                flux TEXT NOT NULL,
                orientation TEXT,
                UNIQUE(categorie, sous_categorie, flux, orientation)
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS fact_daily_agg (
                date TEXT NOT NULL,
                dechetterie_id INTEGER NOT NULL REFERENCES dim_dechetterie(id),
                category_id INTEGER NOT NULL REFERENCES dim_category(id),
                poids REAL NOT NULL
            )
            """
        )
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_date ON raw_collectes(date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_lieu ON raw_collectes(lieu_collecte)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_cat ON raw_collectes(categorie)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_raw_flux ON raw_collectes(flux)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_fact_date ON fact_daily_agg(date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_fact_dech ON fact_daily_agg(dechetterie_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_fact_cat ON fact_daily_agg(category_id)")
        cursor.execute("PRAGMA table_info(raw_collectes)")
        columns = {row[1] for row in cursor.fetchall()}
        if 'date_raw' not in columns:
            cursor.execute("ALTER TABLE raw_collectes ADD COLUMN date_raw TEXT")
        conn.commit()
