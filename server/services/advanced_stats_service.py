"""
Advanced statistics service based on raw data and aggregates.
"""

from datetime import datetime, timedelta
from pathlib import Path
import sys

import pandas as pd

from services.db import get_connection, init_db

current_file = Path(__file__).resolve()
project_root = current_file.parent.parent.parent
scripts_dir = project_root / 'scripts'
if scripts_dir.exists() and str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))
try:
    from transform_collectes import DECHETTERIE_MAPPING
except Exception:
    DECHETTERIE_MAPPING = {}


def _resolve_dechetterie_name(row):
    lieu = str(row.get('lieu_collecte') or '').strip()
    sheet = str(row.get('source_sheet') or '').strip()

    if sheet and 'BYM' in sheet.upper():
        return 'BYM'

    if lieu.upper() == 'APPORT VOLONTAIRE':
        return 'Pépinière'

    mapped = DECHETTERIE_MAPPING.get(lieu)
    if mapped:
        return mapped
    return None


def rebuild_aggregates():
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM fact_daily_agg")
        cursor.execute("DELETE FROM dim_dechetterie")
        cursor.execute("DELETE FROM dim_category")

        rows = cursor.execute(
            """
            SELECT date, lieu_collecte, categorie, sous_categorie, flux, orientation, poids, source_sheet
            FROM raw_collectes
            """
        ).fetchall()

        dechetterie_ids = {}
        category_ids = {}

        for row in rows:
            row_dict = dict(row)
            dech_name = _resolve_dechetterie_name(row_dict)
            if not dech_name:
                continue

            if dech_name not in dechetterie_ids:
                cursor.execute(
                    "INSERT INTO dim_dechetterie (name, source_key) VALUES (?, ?)",
                    (dech_name, dech_name.upper())
                )
                dechetterie_ids[dech_name] = cursor.lastrowid

            cat_key = (
                row_dict.get('categorie'),
                row_dict.get('sous_categorie'),
                row_dict.get('flux'),
                row_dict.get('orientation')
            )
            if cat_key not in category_ids:
                cursor.execute(
                    """
                    INSERT INTO dim_category (categorie, sous_categorie, flux, orientation)
                    VALUES (?, ?, ?, ?)
                    """,
                    cat_key
                )
                category_ids[cat_key] = cursor.lastrowid

            cursor.execute(
                """
                INSERT INTO fact_daily_agg (date, dechetterie_id, category_id, poids)
                VALUES (?, ?, ?, ?)
                """,
                (row_dict.get('date'), dechetterie_ids[dech_name], category_ids[cat_key], row_dict.get('poids'))
            )

        conn.commit()

    return {'success': True}


def get_time_series(granularity='day'):
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()

        if granularity == 'week':
            date_expr = "strftime('%Y-%W', date)"
        elif granularity == 'month':
            date_expr = "substr(date,1,7)"
        else:
            date_expr = "date"

        rows = cursor.execute(
            f"""
            SELECT {date_expr} AS period,
                   d.name AS dechetterie,
                   SUM(f.poids) AS total
            FROM fact_daily_agg f
            JOIN dim_dechetterie d ON d.id = f.dechetterie_id
            GROUP BY period, d.name
            ORDER BY period ASC, d.name ASC
            """
        ).fetchall()

    return [dict(row) for row in rows]


def get_category_stats():
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        rows = cursor.execute(
            """
            SELECT
              c.categorie,
              c.sous_categorie,
              SUM(f.poids) AS total
            FROM fact_daily_agg f
            JOIN dim_category c ON c.id = f.category_id
            GROUP BY c.categorie, c.sous_categorie
            ORDER BY total DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def get_flux_orientation_matrix():
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        rows = cursor.execute(
            """
            SELECT
              c.flux,
              COALESCE(c.orientation, 'NON DEFINI') AS orientation,
              SUM(f.poids) AS total
            FROM fact_daily_agg f
            JOIN dim_category c ON c.id = f.category_id
            GROUP BY c.flux, COALESCE(c.orientation, 'NON DEFINI')
            ORDER BY total DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def get_anomalies(limit=10):
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        rows = cursor.execute(
            """
            SELECT
              f.date,
              d.name AS dechetterie,
              c.flux,
              SUM(f.poids) AS total
            FROM fact_daily_agg f
            JOIN dim_dechetterie d ON d.id = f.dechetterie_id
            JOIN dim_category c ON c.id = f.category_id
            GROUP BY f.date, d.name, c.flux
            ORDER BY total DESC
            LIMIT ?
            """,
            (limit,)
        ).fetchall()
    return [dict(row) for row in rows]


def get_missing_days():
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        date_rows = cursor.execute("SELECT DISTINCT date FROM fact_daily_agg ORDER BY date ASC").fetchall()
        if not date_rows:
            return []

        dates = [datetime.strptime(row['date'], '%Y-%m-%d').date() for row in date_rows]
        start = dates[0]
        end = dates[-1]
        all_days = set(start + timedelta(days=i) for i in range((end - start).days + 1))

        dech_rows = cursor.execute(
            """
            SELECT d.name, f.date
            FROM fact_daily_agg f
            JOIN dim_dechetterie d ON d.id = f.dechetterie_id
            """
        ).fetchall()

    by_dech = {}
    for row in dech_rows:
        by_dech.setdefault(row['name'], set()).add(datetime.strptime(row['date'], '%Y-%m-%d').date())

    results = []
    for dech, dates_set in by_dech.items():
        missing = sorted(all_days - dates_set)
        results.append({
            'dechetterie': dech,
            'missing_days': [d.isoformat() for d in missing]
        })

    return results


def get_comparison():
    init_db()
    with get_connection() as conn:
        cursor = conn.cursor()
        rows = cursor.execute(
            """
            SELECT d.name AS dechetterie, SUM(f.poids) AS total
            FROM fact_daily_agg f
            JOIN dim_dechetterie d ON d.id = f.dechetterie_id
            GROUP BY d.name
            ORDER BY total DESC
            """
        ).fetchall()

    total_sum = sum(row['total'] for row in rows) if rows else 0
    avg = total_sum / len(rows) if rows else 0

    results = []
    for row in rows:
        results.append({
            'dechetterie': row['dechetterie'],
            'total': row['total'],
            'delta_vs_avg': row['total'] - avg
        })

    return results
