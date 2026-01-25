"""
SQLite database utilities for raw collectes data.
"""

import sqlite3
from pathlib import Path
from datetime import datetime
import re


LEGACY_DB_NAME = "collectes.db"


def _data_dir():
    base_dir = Path(__file__).resolve().parents[1]
    return base_dir / "data"


def _legacy_db_path():
    return _data_dir() / LEGACY_DB_NAME


def _year_db_path(year):
    return _data_dir() / f"collectes-{int(year)}.db"


def _legacy_year():
    legacy_path = _legacy_db_path()
    if not legacy_path.exists():
        return None
    try:
        conn = sqlite3.connect(str(legacy_path))
        cursor = conn.cursor()
        row = cursor.execute("SELECT MAX(date) AS max_date FROM raw_collectes").fetchone()
        conn.close()
        if not row or not row[0]:
            return None
        return int(str(row[0])[:4])
    except Exception:
        return None


def get_available_years():
    data_dir = _data_dir()
    if not data_dir.exists():
        return []
    years = []
    for db_file in data_dir.glob("collectes-*.db"):
        match = re.match(r"collectes-(\d{4})\.db$", db_file.name)
        if match:
            years.append(int(match.group(1)))
    legacy_year = _legacy_year()
    if legacy_year and legacy_year not in years:
        years.append(legacy_year)
    return sorted(set(years))


def get_latest_year():
    years = get_available_years()
    if years:
        return years[-1]
    return datetime.utcnow().year


def get_year_options():
    available_years = get_available_years()
    current_year = datetime.utcnow().year
    if available_years:
        min_year = min(available_years)
        max_year = max(max(available_years), current_year)
    else:
        min_year = current_year - 1
        max_year = current_year
    if min_year > max_year:
        min_year, max_year = max_year, min_year
    return list(range(min_year, max_year + 1))


def get_db_path(year=None):
    data_dir = _data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    legacy_path = _legacy_db_path()

    if year is None:
        available_years = get_available_years()
        if available_years:
            year = available_years[-1]
        elif legacy_path.exists():
            return legacy_path
        else:
            year = datetime.utcnow().year

    year = int(year)
    year_path = _year_db_path(year)
    if year_path.exists():
        return year_path

    legacy_year = _legacy_year()
    if legacy_path.exists() and legacy_year == year:
        return legacy_path

    return year_path


def ensure_db_dir():
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path


def get_connection(year=None):
    db_path = get_db_path(year)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(year=None):
    with get_connection(year) as conn:
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
