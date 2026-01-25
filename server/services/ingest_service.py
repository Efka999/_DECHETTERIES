"""
Service d'ingestion des fichiers Excel dans la base SQLite.
"""

import hashlib
from pathlib import Path
from datetime import datetime

import pandas as pd

from services.db import get_connection, init_db
from services.advanced_stats_service import rebuild_aggregates
from services.transform_service import _get_project_paths


REQUIRED_COLUMNS = [
    'Catégorie',
    'Sous Catégorie',
    'Flux',
    'Poids',
    'Date',
    'Lieu collecte'
]


def _hash_file(path, chunk_size=1024 * 1024):
    hasher = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()


def _normalize_column_name(name):
    return str(name or '').strip().lower()


def _resolve_columns(columns):
    lookup = {}
    for col in columns:
        lookup[_normalize_column_name(col)] = col
    resolved = {}
    for expected in REQUIRED_COLUMNS + ['Orientation']:
        normalized = _normalize_column_name(expected)
        if normalized in lookup:
            resolved[expected] = lookup[normalized]
    return resolved


def _format_raw_date(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        parsed = pd.to_datetime(value, errors='coerce', dayfirst=True, infer_datetime_format=True)
        if pd.notna(parsed):
            return parsed.strftime('%d/%m/%Y')
    except Exception:
        pass
    return str(value)


def ingest_all_input(force=False, rebuild=True, year=None):
    if year is not None:
        init_db(year)
    project_root, input_dir, _ = _get_project_paths()
    input_dir.mkdir(parents=True, exist_ok=True)

    excel_files = list(input_dir.glob('*.xlsx')) + list(input_dir.glob('*.xls'))
    results = []

    for file_path in excel_files:
        file_hash = _hash_file(file_path)

        try:
            excel_file = pd.ExcelFile(file_path)
        except Exception as exc:
            results.append({
                'filename': file_path.name,
                'status': 'error',
                'error': f"Impossible de lire le fichier: {exc}"
            })
            continue

        per_year_rows = {}
        total_rows = 0
        valid_sheets = 0

        for sheet_name in excel_file.sheet_names:
            try:
                df = pd.read_excel(file_path, sheet_name=sheet_name)
            except Exception:
                continue

            if df.empty:
                continue

            column_map = _resolve_columns(df.columns)
            if not all(col in column_map for col in REQUIRED_COLUMNS):
                continue

            valid_sheets += 1
            total_rows += len(df)

            df = df.rename(columns={v: k for k, v in column_map.items()})

            date_raw = df['Date']
            parsed_dates = pd.to_datetime(date_raw, errors='coerce', dayfirst=True, infer_datetime_format=True)

            numeric_mask = date_raw.apply(lambda x: isinstance(x, (int, float)) and pd.notna(x))
            if numeric_mask.any():
                parsed_numeric = pd.to_datetime(
                    date_raw.where(numeric_mask),
                    errors='coerce',
                    unit='d',
                    origin='1899-12-30'
                )
                parsed_dates = parsed_dates.where(parsed_dates.notna(), parsed_numeric)

            df['Date'] = parsed_dates
            df = df[df['Date'].notna()].copy()

            df['Poids'] = pd.to_numeric(df['Poids'], errors='coerce')
            df = df[df['Poids'].notna()].copy()

            orientation_col = 'Orientation' if 'Orientation' in df.columns else None
            df['Year'] = df['Date'].dt.year

            if year is not None:
                df = df[df['Year'] == int(year)].copy()

            for _, row in df.iterrows():
                row_year = int(row['Year'])
                raw_value = date_raw.loc[row.name] if row.name in date_raw.index else None
                raw_text = _format_raw_date(raw_value)
                per_year_rows.setdefault(row_year, []).append((
                    int(row.name) + 2,
                    row['Date'].date().isoformat(),
                    raw_text,
                    str(row['Lieu collecte']) if pd.notna(row['Lieu collecte']) else '',
                    str(row['Catégorie']) if pd.notna(row['Catégorie']) else '',
                    str(row['Sous Catégorie']) if pd.notna(row['Sous Catégorie']) else None,
                    str(row['Flux']) if pd.notna(row['Flux']) else '',
                    str(row[orientation_col]) if orientation_col and pd.notna(row[orientation_col]) else None,
                    float(row['Poids']),
                    file_path.name,
                    sheet_name
                ))

        if not per_year_rows:
            results.append({
                'filename': file_path.name,
                'status': 'skipped',
                'reason': 'no_valid_rows'
            })
            continue

        for target_year, rows in per_year_rows.items():
            init_db(target_year)
            with get_connection(target_year) as conn:
                cursor = conn.cursor()
                existing = cursor.execute(
                    "SELECT id FROM import_files WHERE file_hash = ?",
                    (file_hash,)
                ).fetchone()

                if existing and not force:
                    continue

                if existing and force:
                    cursor.execute("DELETE FROM raw_collectes WHERE file_id = ?", (existing['id'],))
                    cursor.execute("DELETE FROM import_files WHERE id = ?", (existing['id'],))
                    conn.commit()

                cursor.execute(
                    """
                    INSERT INTO import_files (filename, file_hash, imported_at, row_count, sheet_count)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (file_path.name, file_hash, datetime.utcnow().isoformat(), 0, 0)
                )
                file_id = cursor.lastrowid

                cursor.executemany(
                    """
                    INSERT INTO raw_collectes (
                        file_id,
                        row_index,
                        date,
                        date_raw,
                        lieu_collecte,
                        categorie,
                        sous_categorie,
                        flux,
                        orientation,
                        poids,
                        source_file,
                        source_sheet
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (file_id,) + row
                        for row in rows
                    ]
                )

                cursor.execute(
                    """
                    UPDATE import_files
                    SET row_count = ?, sheet_count = ?
                    WHERE id = ?
                    """,
                    (len(rows), valid_sheets, file_id)
                )
                conn.commit()

        results.append({
            'filename': file_path.name,
            'status': 'imported',
            'rows': sum(len(v) for v in per_year_rows.values()),
            'sheets': valid_sheets,
            'years': sorted(per_year_rows.keys())
        })

    if rebuild and any(r.get('status') == 'imported' for r in results):
        if year is not None:
            rebuild_aggregates(year)
        else:
            for y in {y for r in results for y in r.get('years', [])}:
                rebuild_aggregates(y)

    return {
        'success': True,
        'files': results,
        'input_dir': str(input_dir),
        'file_count': len(excel_files)
    }
