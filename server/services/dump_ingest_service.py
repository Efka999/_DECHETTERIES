"""
Service d'ingestion des fichiers Excel de dump dans la base SQLite dump.
"""

import hashlib
from pathlib import Path
from datetime import datetime

import pandas as pd

from services.db import get_dump_connection, init_dump_db


def _get_project_paths():
    """Get project root, input, and output directories."""
    current_file = Path(__file__).resolve()
    project_root = current_file.parent.parent.parent
    input_dir = project_root / 'input'
    output_dir = project_root / 'output'
    return project_root, input_dir, output_dir


DUMP_REQUIRED_COLUMNS = [
    'Catégorie',
    'Flux',
    'Poids',
    'Date',
    'Lieu collecte'
]


def _hash_file(path, chunk_size=1024 * 1024):
    """Calculate SHA256 hash of a file."""
    hasher = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            hasher.update(chunk)
    return hasher.hexdigest()


def _normalize_column_name(name):
    """Normalize column name for comparison."""
    return str(name or '').strip()


def _format_date_iso(value):
    """Format date to ISO format (YYYY-MM-DD)."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        parsed = pd.to_datetime(value, errors='coerce')
        if pd.notna(parsed):
            return parsed.strftime('%Y-%m-%d')
    except Exception:
        pass
    return None


def _format_date_fr(value):
    """Format date to French format (dd/mm/yyyy)."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        parsed = pd.to_datetime(value, errors='coerce')
        if pd.notna(parsed):
            return parsed.strftime('%d/%m/%Y')
    except Exception:
        pass
    return str(value) if value is not None else None


def _format_time(value):
    """Format time to HH:MM:SS format."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        if isinstance(value, str):
            # Try parsing as time string
            if ':' in value:
                parts = value.split(':')
                if len(parts) >= 2:
                    return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}:00"
        elif isinstance(value, datetime):
            return value.strftime('%H:%M:%S')
        elif isinstance(value, pd.Timestamp):
            return value.strftime('%H:%M:%S')
    except Exception:
        pass
    return str(value) if value is not None else None


def ingest_dump_file(file_path=None, year=2025, force=False, progress=None):
    """
    Ingest a dump Excel file into the dump database.
    
    Args:
        file_path: Path to the Excel file. If None, looks for '2025_Analyse Catégories.xlsx' in input/
        year: Year for the dump database (default: 2025)
        force: If True, re-import even if file was already imported
        progress: Optional callback function for progress updates
        
    Returns:
        dict with import results
    """
    init_dump_db(year)
    
    # Determine file path
    if file_path is None:
        _, input_dir, _ = _get_project_paths()
        file_path = Path(input_dir) / f"{year}_Analyse Catégories.xlsx"
    else:
        file_path = Path(file_path)
    
    if not file_path.exists():
        return {
            'success': False,
            'message': f'Fichier introuvable: {file_path}',
            'file_path': str(file_path)
        }
    
    file_hash = _hash_file(file_path)
    
    if progress:
        progress({
            'event': 'file',
            'message': f"Lecture du fichier {file_path.name}"
        })
    
    try:
        excel_file = pd.ExcelFile(file_path)
    except Exception as exc:
        return {
            'success': False,
            'message': f'Impossible de lire le fichier: {exc}',
            'filename': file_path.name
        }
    
    # Read the "A" sheet (or first sheet if "A" doesn't exist)
    sheet_name = 'A' if 'A' in excel_file.sheet_names else excel_file.sheet_names[0]
    
    try:
        df = pd.read_excel(file_path, sheet_name=sheet_name)
    except Exception as exc:
        return {
            'success': False,
            'message': f'Impossible de lire la feuille {sheet_name}: {exc}',
            'filename': file_path.name,
            'sheet': sheet_name
        }
    
    # Check required columns
    missing_columns = []
    for col in DUMP_REQUIRED_COLUMNS:
        if col not in df.columns:
            missing_columns.append(col)
    
    if missing_columns:
        return {
            'success': False,
            'message': f'Colonnes manquantes: {", ".join(missing_columns)}',
            'filename': file_path.name,
            'missing_columns': missing_columns
        }
    
    # Normalize column names (keep original names but handle variations)
    column_mapping = {
        'Date': 'Date',
        'Heure': 'Heure',
        'Lieu collecte': 'Lieu collecte',
        'Catégorie': 'Catégorie',
        'Sous Catégorie': 'Sous Catégorie',
        'Flux': 'Flux',
        'Orientation': 'Orientation',
        'Poids': 'Poids',
        'Origine': 'Origine',
        'Secteur collecte': 'Secteur collecte',
        'Compte': 'Compte',
        'Nombre': 'Nombre',
        'Volume en m3': 'Volume en m3',
        'site': 'site',
        'pôle': 'pôle',
        'Tournee': 'Tournee'
    }
    
    # Check if we have all expected columns
    available_columns = set(df.columns)
    for expected_col in column_mapping.keys():
        if expected_col not in available_columns:
            # Try to find a similar column (case-insensitive, with/without accents)
            for col in df.columns:
                if _normalize_column_name(col) == _normalize_column_name(expected_col):
                    column_mapping[expected_col] = col
                    break
    
    # Prepare rows for insertion
    rows_to_insert = []
    errors = []
    
    for idx, row in df.iterrows():
        try:
            # Parse date
            date_value = row.get('Date')
            date_iso = _format_date_iso(date_value)
            date_raw = _format_date_fr(date_value)
            
            if not date_iso:
                errors.append(f"Ligne {idx + 2}: Date invalide")
                continue
            
            # Parse time
            heure = _format_time(row.get('Heure'))
            
            # Get required fields
            lieu_collecte = str(row.get('Lieu collecte', '')).strip()
            categorie = str(row.get('Catégorie', '')).strip()
            flux = str(row.get('Flux', '')).strip()
            poids_value = row.get('Poids')
            
            if not lieu_collecte:
                errors.append(f"Ligne {idx + 2}: Lieu collecte manquant")
                continue
            if not categorie:
                errors.append(f"Ligne {idx + 2}: Catégorie manquante")
                continue
            if not flux:
                errors.append(f"Ligne {idx + 2}: Flux manquant")
                continue
            
            # Parse poids
            try:
                poids = float(poids_value) if pd.notna(poids_value) else 0.0
            except (ValueError, TypeError):
                errors.append(f"Ligne {idx + 2}: Poids invalide: {poids_value}")
                continue
            
            # Get optional fields
            sous_categorie = str(row.get('Sous Catégorie', '')).strip() if pd.notna(row.get('Sous Catégorie')) else None
            orientation = str(row.get('Orientation', '')).strip() if pd.notna(row.get('Orientation')) else None
            origine = str(row.get('Origine', '')).strip() if pd.notna(row.get('Origine')) else None
            secteur_collecte = str(row.get('Secteur collecte', '')).strip() if pd.notna(row.get('Secteur collecte')) else None
            compte = str(row.get('Compte', '')).strip() if pd.notna(row.get('Compte')) else None
            tournee = str(row.get('Tournee', '')).strip() if pd.notna(row.get('Tournee')) else None
            
            # Parse nombre
            nombre = None
            nombre_value = row.get('Nombre')
            if pd.notna(nombre_value):
                try:
                    nombre = int(nombre_value)
                except (ValueError, TypeError):
                    pass
            
            # Parse volume_m3
            volume_m3 = None
            volume_value = row.get('Volume en m3')
            if pd.notna(volume_value):
                try:
                    volume_m3 = float(volume_value)
                except (ValueError, TypeError):
                    pass
            
            # Get site and pole
            site = str(row.get('site', '')).strip() if pd.notna(row.get('site')) else None
            pole = str(row.get('pôle', '')).strip() if pd.notna(row.get('pôle')) else None
            
            rows_to_insert.append((
                int(idx),  # row_index
                date_iso,  # date
                date_raw,  # date_raw
                heure,  # heure
                lieu_collecte,  # lieu_collecte
                categorie,  # categorie
                sous_categorie if sous_categorie else None,  # sous_categorie
                flux,  # flux
                orientation if orientation else None,  # orientation
                origine if origine else None,  # origine
                secteur_collecte if secteur_collecte else None,  # secteur_collecte
                compte if compte else None,  # compte
                nombre,  # nombre
                poids,  # poids
                volume_m3,  # volume_m3
                site if site else None,  # site
                pole if pole else None,  # pole
                tournee if tournee else None,  # tournee
                file_path.name,  # source_file
                sheet_name  # source_sheet
            ))
        except Exception as exc:
            errors.append(f"Ligne {idx + 2}: Erreur: {exc}")
    
    if progress:
        progress({
            'event': 'processing',
            'message': f"Traitement de {len(rows_to_insert)} lignes valides"
        })
    
    # Insert into database
    with get_dump_connection(year) as conn:
        cursor = conn.cursor()
        
        # Check if file was already imported
        existing = cursor.execute(
            "SELECT id FROM import_dump_files WHERE file_hash = ?",
            (file_hash,)
        ).fetchone()
        
        if existing and not force:
            return {
                'success': True,
                'message': 'Fichier déjà importé (utilisez force=True pour réimporter)',
                'filename': file_path.name,
                'file_id': existing['id'],
                'rows': 0,
                'errors': []
            }
        
        if existing and force:
            cursor.execute("DELETE FROM raw_dump WHERE file_id = ?", (existing['id'],))
            cursor.execute("DELETE FROM import_dump_files WHERE id = ?", (existing['id'],))
            conn.commit()
        
        # Insert file record
        cursor.execute(
            """
            INSERT INTO import_dump_files (filename, file_hash, imported_at, row_count, sheet_count)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                file_path.name,
                file_hash,
                datetime.utcnow().isoformat(),
                len(rows_to_insert),
                1
            )
        )
        file_id = cursor.lastrowid
        
        # Insert rows
        cursor.executemany(
            """
            INSERT INTO raw_dump (
                file_id, row_index, date, date_raw, heure,
                lieu_collecte, categorie, sous_categorie, flux, orientation,
                origine, secteur_collecte, compte, nombre, poids,
                volume_m3, site, pole, tournee, source_file, source_sheet
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [(file_id,) + row for row in rows_to_insert]
        )
        
        conn.commit()
    
    return {
        'success': True,
        'message': 'Import réussi',
        'filename': file_path.name,
        'file_id': file_id,
        'rows': len(rows_to_insert),
        'errors': errors[:100],  # Limit errors to first 100
        'error_count': len(errors),
        'sheet': sheet_name
    }
