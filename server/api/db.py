"""
Endpoints API pour la base SQLite (ingestion et stats).
"""

from flask import Blueprint, jsonify, request

from services.ingest_service import ingest_all_input
from services.stats_service import build_stats_from_db
from services.advanced_stats_service import (
    rebuild_aggregates,
    get_time_series,
    get_category_stats,
    get_flux_orientation_matrix,
    get_anomalies,
    get_missing_days,
    get_comparison
)
from services.db import get_connection, init_db, get_latest_year, get_year_options


db_bp = Blueprint('db', __name__)


@db_bp.route('/db/import', methods=['POST'])
def import_db():
    payload = request.get_json(silent=True) or {}
    force = bool(payload.get('force', False))
    rebuild = bool(payload.get('rebuild', True))
    year = request.args.get('year') or payload.get('year')
    try:
        result = ingest_all_input(force=force, rebuild=rebuild, year=year)
        return jsonify(result), 200
    except Exception as exc:
        return jsonify({
            'success': False,
            'message': 'Erreur lors de l\'ingestion',
            'error': str(exc)
        }), 500


@db_bp.route('/db/status', methods=['GET'])
def db_status():
    year = request.args.get('year')
    init_db(year)
    with get_connection(year) as conn:
        cursor = conn.cursor()
        row = cursor.execute("SELECT COUNT(*) AS count FROM raw_collectes").fetchone()
        file_row = cursor.execute("SELECT COUNT(*) AS count FROM import_files").fetchone()
        last_import = cursor.execute(
            "SELECT filename, imported_at, row_count, sheet_count FROM import_files ORDER BY imported_at DESC LIMIT 1"
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


@db_bp.route('/stats', methods=['GET'])
def stats_from_db():
    try:
        year = request.args.get('year')
        result = build_stats_from_db(year)
        if result['success']:
            return jsonify({
                'success': True,
                'stats': result['stats'],
                'message': 'Statistiques extraites depuis la base'
            }), 200
        return jsonify({
            'success': False,
            'message': 'Erreur lors du calcul des statistiques',
            'error': result['error']
        }), 500
    except Exception as exc:
        return jsonify({
            'success': False,
            'message': 'Erreur lors du calcul des statistiques',
            'error': str(exc)
        }), 500


@db_bp.route('/db/rebuild-aggregates', methods=['POST'])
def rebuild_aggregates_endpoint():
    try:
        year = request.args.get('year')
        result = rebuild_aggregates(year)
        return jsonify(result), 200
    except Exception as exc:
        return jsonify({
            'success': False,
            'message': 'Erreur lors de la reconstruction des agrégats',
            'error': str(exc)
        }), 500


@db_bp.route('/stats/advanced/series', methods=['GET'])
def advanced_series():
    granularity = request.args.get('granularity', 'day')
    try:
        year = request.args.get('year')
        data = get_time_series(granularity, year)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


@db_bp.route('/stats/advanced/category', methods=['GET'])
def advanced_category():
    try:
        year = request.args.get('year')
        data = get_category_stats(year)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


@db_bp.route('/stats/advanced/flux-orientation', methods=['GET'])
def advanced_flux_orientation():
    try:
        year = request.args.get('year')
        data = get_flux_orientation_matrix(year)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


@db_bp.route('/stats/advanced/anomalies', methods=['GET'])
def advanced_anomalies():
    limit = int(request.args.get('limit', 10))
    try:
        year = request.args.get('year')
        data = get_anomalies(limit, year)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


@db_bp.route('/stats/advanced/missing-days', methods=['GET'])
def advanced_missing_days():
    try:
        year = request.args.get('year')
        data = get_missing_days(year)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


@db_bp.route('/stats/advanced/comparison', methods=['GET'])
def advanced_comparison():
    try:
        year = request.args.get('year')
        data = get_comparison(year)
        return jsonify({'success': True, 'data': data}), 200
    except Exception as exc:
        return jsonify({'success': False, 'error': str(exc)}), 500


@db_bp.route('/db/years', methods=['GET'])
def db_years():
    years = get_year_options()
    return jsonify({
        'success': True,
        'years': years,
        'latest': get_latest_year()
    }), 200


@db_bp.route('/db/raw', methods=['GET'])
def raw_data():
    year = request.args.get('year')
    init_db(year)
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

    with get_connection(year) as conn:
        cursor = conn.cursor()
        total_row = cursor.execute("SELECT COUNT(*) AS count FROM raw_collectes").fetchone()
        total = total_row['count'] if total_row else 0

        rows = cursor.execute(
            """
            SELECT id, date, date_raw, lieu_collecte, categorie, sous_categorie, flux, orientation, poids, source_file, source_sheet
            FROM raw_collectes
            ORDER BY date ASC, id ASC
            LIMIT ? OFFSET ?
            """,
            (limit, offset)
        ).fetchall()

    items = [dict(row) for row in rows]
    return jsonify({
        'success': True,
        'items': items,
        'limit': limit,
        'offset': offset,
        'total': total
    }), 200
