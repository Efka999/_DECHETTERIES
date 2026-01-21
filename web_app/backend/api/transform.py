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
    # Structure: _DECHETTERIES/web_app/backend/api/transform.py
    current_file = Path(__file__).resolve()
    project_root = current_file.parent.parent.parent.parent
    output_dir = project_root / 'output'
    
    # Si pas trouvé, essayer depuis le répertoire de travail
    if not output_dir.exists():
        cwd = Path.cwd()
        if 'web_app' in str(cwd):
            current = cwd
            while current != current.parent:
                potential = current.parent / 'output'
                if potential.exists() or current.parent.name == '_DECHETTERIES':
                    output_dir = potential
                    break
                current = current.parent
        else:
            output_dir = cwd / 'output'
    
    # Chercher le fichier dans output/
    file_path = output_dir / safe_filename
    
    # Si pas trouvé, essayer avec le chemin complet fourni
    if not file_path.exists():
        potential_path = Path(filename)
        if potential_path.exists() and potential_path.is_file():
            file_path = potential_path
        else:
            return jsonify({
                'success': False,
                'message': 'Fichier introuvable',
                'error': f'Le fichier {safe_filename} n\'a pas été trouvé dans {output_dir}'
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
    # Sécuriser le nom de fichier
    safe_filename = secure_filename(os.path.basename(filename))
    
    # Chercher le fichier dans le dossier output à la racine du projet
    # Structure: _DECHETTERIES/web_app/backend/api/transform.py
    current_file = Path(__file__).resolve()
    project_root = current_file.parent.parent.parent.parent
    output_dir = project_root / 'output'
    
    # Si pas trouvé, essayer depuis le répertoire de travail
    if not output_dir.exists():
        cwd = Path.cwd()
        if 'web_app' in str(cwd):
            current = cwd
            while current != current.parent:
                potential = current.parent / 'output'
                if potential.exists() or current.parent.name == '_DECHETTERIES':
                    output_dir = potential
                    break
                current = current.parent
        else:
            output_dir = cwd / 'output'
    
    # Chercher le fichier dans output/
    file_path = output_dir / safe_filename
    
    # Si pas trouvé, essayer avec le chemin complet fourni
    if not file_path.exists():
        potential_path = Path(filename)
        if potential_path.exists() and potential_path.is_file():
            file_path = potential_path
        else:
            return jsonify({
                'success': False,
                'message': 'Fichier introuvable',
                'error': f'Le fichier {safe_filename} n\'a pas été trouvé dans {output_dir}'
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
