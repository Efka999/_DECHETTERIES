"""
Endpoints API pour la transformation de fichiers
"""

from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
from pathlib import Path
import sys

# Ajouter le chemin parent pour les imports relatifs
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.transform_service import transform_excel_file, cleanup_temp_file
from services.stats_service import parse_output_excel

api_bp = Blueprint('transform', __name__)

# Extensions autorisées
ALLOWED_EXTENSIONS = {'xlsx', 'xls'}

def allowed_file(filename):
    """Vérifie si l'extension du fichier est autorisée"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@api_bp.route('/status', methods=['GET'])
def status():
    """Vérifie que le serveur fonctionne"""
    return jsonify({
        'status': 'ok',
        'message': 'Serveur opérationnel'
    }), 200


@api_bp.route('/transform', methods=['POST'])
def transform():
    """
    Endpoint pour transformer un fichier Excel
    
    Body (multipart/form-data):
        - file: Fichier Excel à transformer
    
    Returns:
        JSON avec le résultat de la transformation
    """
    # Vérifier qu'un fichier a été uploadé
    if 'file' not in request.files:
        return jsonify({
            'success': False,
            'message': 'Aucun fichier fourni',
            'error': 'Le paramètre "file" est requis'
        }), 400
    
    file = request.files['file']
    
    # Vérifier qu'un fichier a été sélectionné
    if file.filename == '':
        return jsonify({
            'success': False,
            'message': 'Aucun fichier sélectionné',
            'error': 'Veuillez sélectionner un fichier'
        }), 400
    
    # Vérifier l'extension
    if not allowed_file(file.filename):
        return jsonify({
            'success': False,
            'message': 'Type de fichier non autorisé',
            'error': f'Seuls les fichiers .xlsx et .xls sont acceptés. Fichier reçu : {file.filename}'
        }), 400
    
    # Vérifier la taille du fichier (max 100 MB)
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)  # Réinitialiser la position
    
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
    if file_size > MAX_FILE_SIZE:
        return jsonify({
            'success': False,
            'message': 'Fichier trop volumineux',
            'error': f'La taille maximale est de 100 MB. Fichier reçu : {file_size / (1024*1024):.2f} MB'
        }), 400
    
    try:
        # Transformer le fichier
        result = transform_excel_file(file)
        
        if result['success']:
            # Le fichier de sortie est dans le résultat
            output_filename = result.get('output_filename') or Path(result['output_path']).name
            return jsonify({
                'success': True,
                'message': result['message'],
                'output_filename': output_filename,
                'output_path': result['output_path']
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': result['message'],
                'error': result.get('error', 'Erreur inconnue')
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'Erreur lors de la transformation',
            'error': str(e)
        }), 500


@api_bp.route('/download/<path:filename>', methods=['GET'])
def download(filename):
    """
    Télécharge le fichier généré
    
    Args:
        filename: Nom du fichier à télécharger (peut contenir le chemin)
    
    Returns:
        Fichier Excel en téléchargement
    """
    # Sécuriser le nom de fichier
    safe_filename = secure_filename(os.path.basename(filename))
    
    # Chercher le fichier dans le dossier output à la racine du projet
    # Utiliser la fonction helper pour trouver le dossier output
    from services.transform_service import _get_project_paths
    _, _, output_dir = _get_project_paths()
    
    # Extraire le nom de fichier (sans chemin)
    filename_basename = os.path.basename(filename)
    
    # Chercher le fichier dans output/ - essayer d'abord avec le nom exact (avec espaces)
    # car secure_filename transforme les espaces en underscores
    file_path = output_dir / filename_basename
    
    # Si pas trouvé, essayer avec secure_filename (pour les noms avec espaces encodés)
    if not file_path.exists():
        file_path = output_dir / safe_filename
    
    # Si toujours pas trouvé, essayer avec le chemin complet fourni
    if not file_path.exists():
        potential_path = Path(filename)
        if potential_path.exists() and potential_path.is_file():
            file_path = potential_path
        else:
            # Lister les fichiers disponibles pour debug
            available_files = [f.name for f in output_dir.glob('*.xlsx')] if output_dir.exists() else []
            return jsonify({
                'success': False,
                'message': 'Fichier introuvable',
                'error': f'Le fichier {filename_basename} n\'a pas été trouvé dans {output_dir}',
                'available_files': available_files
            }), 404
    
    if not file_path.exists():
        return jsonify({
            'success': False,
            'message': 'Fichier introuvable',
            'error': f'Le fichier {safe_filename} n\'a pas été trouvé'
        }), 404
    
    try:
        # Envoyer le fichier
        response = send_file(
            str(file_path),
            as_attachment=True,
            download_name=safe_filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
        # Nettoyer le fichier après envoi (en arrière-plan)
        # Note: On pourrait utiliser un thread pour nettoyer après un délai
        # Pour l'instant, on laisse le fichier pour permettre le téléchargement
        
        return response
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'Erreur lors du téléchargement',
            'error': str(e)
        }), 500


@api_bp.route('/stats/<path:filename>', methods=['GET'])
def get_stats(filename):
    """
    Extrait les statistiques du fichier Excel de sortie
    
    Args:
        filename: Nom du fichier (peut contenir le chemin)
    
    Returns:
        JSON avec les statistiques
    """
    # Extraire le nom de fichier (sans chemin)
    filename_basename = os.path.basename(filename)
    
    # Chercher le fichier dans le dossier output à la racine du projet
    # Utiliser la fonction helper pour trouver le dossier output
    from services.transform_service import _get_project_paths
    import logging
    logger = logging.getLogger(__name__)
    
    _, _, output_dir = _get_project_paths()
    
    logger.info(f"[get_stats] Looking for file: {filename_basename}")
    logger.info(f"[get_stats] Output dir: {output_dir}")
    logger.info(f"[get_stats] Output dir exists: {output_dir.exists()}")
    
    if output_dir.exists():
        all_files = list(output_dir.glob('*.xlsx'))
        logger.info(f"[get_stats] All files in output: {[f.name for f in all_files]}")
    
    # Chercher le fichier dans output/ - essayer d'abord avec le nom exact
    file_path = output_dir / filename_basename
    
    # Si pas trouvé, essayer avec secure_filename (pour les noms avec espaces encodés)
    if not file_path.exists():
        safe_filename = secure_filename(filename_basename)
        logger.info(f"[get_stats] Trying with safe_filename: {safe_filename}")
        file_path = output_dir / safe_filename
    
    # Si toujours pas trouvé, essayer avec le chemin complet fourni
    if not file_path.exists():
        potential_path = Path(filename)
        if potential_path.exists() and potential_path.is_file():
            file_path = potential_path
            logger.info(f"[get_stats] Found file at absolute path: {file_path}")
        else:
            # Lister les fichiers disponibles pour debug
            available_files = [f.name for f in output_dir.glob('*.xlsx')] if output_dir.exists() else []
            logger.warning(f"[get_stats] File not found. Available files: {available_files}")
            return jsonify({
                'success': False,
                'message': 'Fichier introuvable',
                'error': f'Le fichier {filename_basename} n\'a pas été trouvé dans {output_dir}',
                'available_files': available_files
            }), 404
    
    try:
        result = parse_output_excel(str(file_path))
        
        if result['success']:
            return jsonify({
                'success': True,
                'stats': result['stats'],
                'message': 'Statistiques extraites avec succès'
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Erreur lors de l\'extraction des statistiques',
                'error': result['error']
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'Erreur lors de l\'extraction des statistiques',
            'error': str(e)
        }), 500
