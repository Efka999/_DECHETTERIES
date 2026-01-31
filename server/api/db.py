"""
Endpoints API pour la base SQLite dump (ingestion et stats).
"""

from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename
import os
import shutil
from pathlib import Path

from services.db import get_dump_connection, init_dump_db, get_dump_available_years
from services.dump_ingest_service import ingest_dump_file
from services.dump_stats_service import (
    build_stats_from_dump_db,
    get_time_series as get_dump_time_series,
    get_category_stats as get_dump_category_stats,
    get_flux_orientation_matrix as get_dump_flux_orientation_matrix,
    get_anomalies as get_dump_anomalies,
    get_missing_days as get_dump_missing_days,
    get_comparison as get_dump_comparison
)


db_bp = Blueprint('db', __name__)


# ============================================================================
# Dump endpoints
# ============================================================================


@db_bp.route('/db/dump/import', methods=['POST'])
def import_dump():
    """Import dump file into dump database."""
    payload = request.get_json(silent=True) or {}
    force = bool(payload.get('force', False))
    year = request.args.get('year') or payload.get('year', 2025)
    file_path = payload.get('file_path')
    
    try:
        year = int(year)
        result = ingest_dump_file(file_path=file_path, year=year, force=force)
        return jsonify(result), 200
    except Exception as exc:
        return jsonify({
            'success': False,
            'message': 'Erreur lors de l\'ingestion du dump',
            'error': str(exc)
        }), 500


@db_bp.route('/db/dump/status', methods=['GET'])
def dump_status():
    """Get status of dump database."""
    year = request.args.get('year', 2025)
    try:
        year = int(year)
        init_dump_db(year)
        with get_dump_connection(year) as conn:
            cursor = conn.cursor()
            row = cursor.execute("SELECT COUNT(*) AS count FROM raw_dump").fetchone()
            file_row = cursor.execute("SELECT COUNT(*) AS count FROM import_dump_files").fetchone()
            last_import = cursor.execute(
                "SELECT filename, imported_at, row_count, sheet_count FROM import_dump_files ORDER BY imported_at DESC LIMIT 1"
            ).fetchone()

        return jsonify({
            'success': True,
            'rows': row['count'] if row else 0,
            'files': file_row['count'] if file_row else 0,
            'last_import': {
                'filename': last_import['filename'],
                'imported_at': last_import['imported_at'],
                'row_count': last_import['row_count'],
                'sheet_count': last_import['sheet_count']
            } if last_import else None
        }), 200
    except Exception as exc:
        return jsonify({
            'success': False,
            'message': 'Erreur lors de la récupération du statut',
            'error': str(exc)
        }), 500


@db_bp.route('/db/dump/stats', methods=['GET'])
def dump_stats():
    """Get statistics from dump database."""
    try:
        year = request.args.get('year', 2025)
        year = int(year)
        result = build_stats_from_dump_db(year)
        if result.get('success') and result.get('stats'):
            # Vérification supplémentaire : s'assurer que global_totals existe
            stats = result.get('stats')
            if not stats.get('global_totals'):
                return jsonify({
                    'success': False,
                    'message': 'Format de données invalide : global_totals manquant',
                    'error': 'Les statistiques ne contiennent pas global_totals'
                }), 500
            return jsonify({
                'success': True,
                'stats': stats,
                'message': 'Statistiques extraites depuis la base dump'
            }), 200
        return jsonify({
            'success': False,
            'message': 'Erreur lors du calcul des statistiques',
            'error': result.get('error', 'Erreur inconnue')
        }), 500
    except Exception as exc:
        import traceback
        return jsonify({
            'success': False,
            'message': 'Erreur lors du calcul des statistiques',
            'error': str(exc),
            'traceback': traceback.format_exc()
        }), 500


@db_bp.route('/db/dump/stats/advanced/series', methods=['GET'])
def dump_advanced_series():
    """Get time series from dump database."""
    granularity = request.args.get('granularity', 'day')
    try:
        year = request.args.get('year', 2025)
        year = int(year)
        data = get_dump_time_series(granularity, year)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


@db_bp.route('/db/dump/stats/advanced/category', methods=['GET'])
def dump_advanced_category():
    """Get category statistics from dump database."""
    try:
        year = request.args.get('year', 2025)
        year = int(year)
        data = get_dump_category_stats(year)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


@db_bp.route('/db/dump/stats/advanced/flux-orientation', methods=['GET'])
def dump_advanced_flux_orientation():
    """Get flux-orientation matrix from dump database."""
    try:
        year = request.args.get('year', 2025)
        year = int(year)
        data = get_dump_flux_orientation_matrix(year)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


@db_bp.route('/db/dump/stats/advanced/anomalies', methods=['GET'])
def dump_advanced_anomalies():
    """Get anomalies from dump database."""
    limit = int(request.args.get('limit', 10))
    try:
        year = request.args.get('year', 2025)
        year = int(year)
        data = get_dump_anomalies(limit, year)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


@db_bp.route('/db/dump/stats/advanced/missing-days', methods=['GET'])
def dump_advanced_missing_days():
    """Get missing days from dump database."""
    try:
        year = request.args.get('year', 2025)
        year = int(year)
        data = get_dump_missing_days(year)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


@db_bp.route('/db/dump/stats/advanced/comparison', methods=['GET'])
def dump_advanced_comparison():
    """Get comparison statistics from dump database."""
    try:
        year = request.args.get('year', 2025)
        year = int(year)
        data = get_dump_comparison(year)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


@db_bp.route('/db/dump/raw', methods=['GET'])
def dump_raw_data():
    """Get raw data from dump database with pagination and filters."""
    year = request.args.get('year', 2025)
    try:
        year = int(year)
        init_dump_db(year)
        try:
            limit = int(request.args.get('limit', 50))
            offset = int(request.args.get('offset', 0))
        except ValueError:
            return jsonify({
                'success': False,
                'message': 'Paramètres invalides',
                'error': 'limit et offset doivent être des entiers'
            }), 400

        limit = max(1, min(limit, 500))
        offset = max(0, offset)

        with get_dump_connection(year) as conn:
            cursor = conn.cursor()
            filters = []
            params = []

            query = request.args.get('q')
            if query:
                like = f"%{query}%"
                filters.append(
                    "("
                    "lieu_collecte LIKE ? OR categorie LIKE ? OR sous_categorie LIKE ? "
                    "OR flux LIKE ? OR orientation LIKE ? OR origine LIKE ? OR secteur_collecte LIKE ? "
                    "OR source_file LIKE ? OR source_sheet LIKE ?"
                    ")"
                )
                params.extend([like] * 9)

            for key in ['lieu_collecte', 'categorie', 'sous_categorie', 'flux', 'orientation', 
                       'origine', 'secteur_collecte', 'source_file', 'source_sheet']:
                value = request.args.get(key)
                if value:
                    filters.append(f"{key} LIKE ?")
                    params.append(f"%{value}%")

            date_from = request.args.get('date_from')
            date_to = request.args.get('date_to')
            if date_from:
                filters.append("date >= ?")
                params.append(date_from)
            if date_to:
                filters.append("date <= ?")
                params.append(date_to)

            where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""

            total_row = cursor.execute(
                f"SELECT COUNT(*) AS count FROM raw_dump {where_clause}",
                params
            ).fetchone()
            total = total_row['count'] if total_row else 0

            rows = cursor.execute(
                f"""
                SELECT id, date, date_raw, heure, lieu_collecte, categorie, sous_categorie, 
                       flux, orientation, origine, secteur_collecte, compte, nombre, poids, 
                       volume_m3, site, pole, tournee, source_file, source_sheet
                FROM raw_dump
                {where_clause}
                ORDER BY date ASC, id ASC
                LIMIT ? OFFSET ?
                """,
                [*params, limit, offset]
            ).fetchall()

        items = [dict(row) for row in rows]
        return jsonify({
            'success': True,
            'items': items,
            'limit': limit,
            'offset': offset,
            'total': total
        }), 200
    except Exception as exc:
        return jsonify({
            'success': False,
            'message': 'Erreur lors de la récupération des données',
            'error': str(exc)
        }), 500


@db_bp.route('/db/dump/raw/options', methods=['GET'])
def dump_raw_data_options():
    """Get filter options for dump raw data."""
    year = request.args.get('year', 2025)
    try:
        year = int(year)
        init_dump_db(year)

        def fetch_distinct(cursor, column, limit=200):
            rows = cursor.execute(
                f"""
                SELECT DISTINCT {column}
                FROM raw_dump
                WHERE {column} IS NOT NULL AND {column} != ''
                ORDER BY {column} ASC
                LIMIT ?
                """,
                (limit,)
            ).fetchall()
            return [row[column] for row in rows]

        with get_dump_connection(year) as conn:
            cursor = conn.cursor()
            options = {
                'lieu_collecte': fetch_distinct(cursor, 'lieu_collecte'),
                'categorie': fetch_distinct(cursor, 'categorie'),
                'sous_categorie': fetch_distinct(cursor, 'sous_categorie'),
                'flux': fetch_distinct(cursor, 'flux'),
                'orientation': fetch_distinct(cursor, 'orientation'),
                'origine': fetch_distinct(cursor, 'origine'),
                'secteur_collecte': fetch_distinct(cursor, 'secteur_collecte'),
                'source_file': fetch_distinct(cursor, 'source_file'),
                'source_sheet': fetch_distinct(cursor, 'source_sheet')
            }

        return jsonify({
            'success': True,
            'options': options
        }), 200
    except Exception as exc:
        return jsonify({
            'success': False,
            'message': 'Erreur lors de la récupération des options',
            'error': str(exc)
        }), 500


@db_bp.route('/db/dump/years', methods=['GET'])
def dump_years():
    """Get available years for dump databases."""
    years = get_dump_available_years()
    return jsonify({
        'success': True,
        'years': years
    }), 200


# ============================================================================
# File management endpoints (Input/Output files)
# ============================================================================

@db_bp.route('/files/output/list', methods=['GET'])
def list_output_files():
    """List available output files (Excel reports)."""
    try:
        output_dir = Path(__file__).parent.parent.parent / 'output'
        if not output_dir.exists():
            return jsonify({
                'success': True,
                'files': []
            }), 200
        
        files = []
        for file in output_dir.glob('*.xlsx'):
            files.append({
                'name': file.name,
                'size': file.stat().st_size,
                'modified': file.stat().st_mtime
            })
        
        # Sort by modified date, newest first
        files.sort(key=lambda x: x['modified'], reverse=True)
        
        return jsonify({
            'success': True,
            'files': files
        }), 200
    except Exception as exc:
        return jsonify({
            'success': False,
            'error': str(exc)
        }), 500


@db_bp.route('/files/output/download/<filename>', methods=['GET'])
def download_output_file(filename):
    """Download an output Excel file."""
    try:
        # Sanitize filename
        filename = secure_filename(filename)
        output_dir = Path(__file__).parent.parent.parent / 'output'
        file_path = output_dir / filename
        
        # Security check
        if not file_path.exists() or not file_path.is_file():
            return jsonify({
                'success': False,
                'error': 'File not found'
            }), 404
        
        if not str(file_path).startswith(str(output_dir)):
            return jsonify({
                'success': False,
                'error': 'Invalid file path'
            }), 403
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as exc:
        return jsonify({
            'success': False,
            'error': str(exc)
        }), 500


@db_bp.route('/files/input/upload', methods=['POST'])
def upload_input_file():
    """Upload an input Excel file."""
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file provided'
            }), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'Empty filename'
            }), 400
        
        # Only accept Excel files
        if not file.filename.endswith(('.xlsx', '.xls')):
            return jsonify({
                'success': False,
                'error': 'Only Excel files (.xlsx, .xls) are accepted'
            }), 400
        
        filename = secure_filename(file.filename)
        input_dir = Path(__file__).parent.parent.parent / 'input'
        input_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = input_dir / filename
        file.save(str(file_path))
        
        return jsonify({
            'success': True,
            'filename': filename,
            'size': file_path.stat().st_size
        }), 200
    except Exception as exc:
        return jsonify({
            'success': False,
            'error': str(exc)
        }), 500


@db_bp.route('/files/input/list', methods=['GET'])
def list_input_files():
    """List available input files."""
    try:
        input_dir = Path(__file__).parent.parent.parent / 'input'
        if not input_dir.exists():
            return jsonify({
                'success': True,
                'files': []
            }), 200
        
        files = []
        # Get both .xlsx and .xls files
        for file in list(input_dir.glob('*.xlsx')) + list(input_dir.glob('*.xls')):
            files.append({
                'name': file.name,
                'size': file.stat().st_size,
                'modified': file.stat().st_mtime
            })
        
        # Sort by modified date, newest first
        files.sort(key=lambda x: x['modified'], reverse=True)
        
        return jsonify({
            'success': True,
            'files': files
        }), 200
    except Exception as exc:
        return jsonify({
            'success': False,
            'error': str(exc)
        }), 500
