"""
SQLite database utilities for dump data.
"""

import sqlite3
from pathlib import Path
import re


def _data_dir():
    base_dir = Path(__file__).resolve().parents[1]
    return base_dir / "data"


# ============================================================================
# Dump database functions
# ============================================================================


def get_dump_db_path(year=2025):
    """Get the path to the dump database for a given year."""
    data_dir = _data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    year = int(year)
    return data_dir / f"dump-{year}.db"


def get_dump_available_years():
    """Get list of years for which dump databases exist."""
    data_dir = _data_dir()
    if not data_dir.exists():
        return []
    years = []
    for db_file in data_dir.glob("dump-*.db"):
        match = re.match(r"dump-(\d{4})\.db$", db_file.name)
        if match:
            years.append(int(match.group(1)))
    return sorted(set(years))


def get_dump_connection(year=2025):
    """Get a connection to the dump database for a given year."""
    db_path = get_dump_db_path(year)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_dump_db(year=2025):
    """Initialize the dump database schema for a given year."""
    with get_dump_connection(year) as conn:
        cursor = conn.cursor()
        
        # Table to track imported dump files
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS import_dump_files (
                id INTEGER PRIMARY KEY,
                filename TEXT NOT NULL,
                file_hash TEXT UNIQUE,
                imported_at TEXT NOT NULL,
                row_count INTEGER,
                sheet_count INTEGER
            )
            """
        )
        
        # Main table for dump data
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS raw_dump (
                id INTEGER PRIMARY KEY,
                file_id INTEGER NOT NULL REFERENCES import_dump_files(id),
                row_index INTEGER,
                date TEXT NOT NULL,
                date_raw TEXT,
                heure TEXT,
                lieu_collecte TEXT NOT NULL,
                categorie TEXT NOT NULL,
                sous_categorie TEXT,
                flux TEXT NOT NULL,
                orientation TEXT,
                origine TEXT,
                secteur_collecte TEXT,
                compte TEXT,
                nombre INTEGER,
                poids REAL NOT NULL,
                volume_m3 REAL,
                site TEXT,
                pole TEXT,
                tournee TEXT,
                source_file TEXT,
                source_sheet TEXT
            )
            """
        )
        
        # Create indexes for performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_dump_date ON raw_dump(date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_dump_lieu ON raw_dump(lieu_collecte)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_dump_cat ON raw_dump(categorie)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_dump_flux ON raw_dump(flux)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_dump_origine ON raw_dump(origine)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_dump_secteur ON raw_dump(secteur_collecte)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_dump_tournee ON raw_dump(tournee)")
        
        conn.commit()
