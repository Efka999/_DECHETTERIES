"""
GDR Dump (Beta) - Serveur Flask pour l'API de transformation des déchetteries
"""

from flask import Flask, jsonify
from flask_cors import CORS
import os
import sys

# Ajouter le chemin pour les imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.db import db_bp
from services.db import init_dump_db

def create_app():
    """Crée et configure l'application Flask"""
    app = Flask(__name__)
    
    # Configuration du logging
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Configuration
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100 MB max
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'temp')
    
    # Créer le dossier d'upload s'il n'existe pas
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Activer CORS pour React (développement et production)
    # Origines locales pour le développement
    allowed_origins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        # HTTPS pour le développement local
        'https://localhost:3000',
        'https://localhost:5173',
        'https://127.0.0.1:3000',
        'https://127.0.0.1:5173'
    ]
    
    # Ajouter l'URL du frontend en production si définie
    frontend_url = os.environ.get('FRONTEND_URL')
    if frontend_url:
        allowed_origins.append(frontend_url)
        # Ajouter aussi sans trailing slash si présent
        if frontend_url.endswith('/'):
            allowed_origins.append(frontend_url.rstrip('/'))
        else:
            allowed_origins.append(frontend_url + '/')
    
    CORS(app, origins=allowed_origins)
    
    # Initialiser la base de données dump (création des tables si nécessaire)
    init_dump_db(2025)

    # Enregistrer les blueprints
    app.register_blueprint(db_bp, url_prefix='/api')
    
    # Route de base
    @app.route('/')
    def index():
        return jsonify({
            'name': 'GDR Dump (Beta) API',
            'version': '1.0.0',
            'status': 'running',
            'endpoints': {
                'status': '/api/status',
                'dump_import': '/api/db/dump/import (POST)',
                'dump_status': '/api/db/dump/status (GET)',
                'dump_stats': '/api/db/dump/stats (GET)',
                'dump_raw': '/api/db/dump/raw (GET)',
                'dump_years': '/api/db/dump/years (GET)'
            }
        })
    
    # Gestion des erreurs
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'success': False,
            'message': 'Endpoint non trouvé',
            'error': 'La route demandée n\'existe pas'
        }), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({
            'success': False,
            'message': 'Erreur interne du serveur',
            'error': str(error) if app.debug else 'Une erreur s\'est produite'
        }), 500
    
    @app.errorhandler(413)
    def request_entity_too_large(error):
        return jsonify({
            'success': False,
            'message': 'Fichier trop volumineux',
            'error': 'La taille maximale du fichier est de 100 MB'
        }), 413
    
    return app


if __name__ == '__main__':
    app = create_app()
    
    # Port par défaut
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    # Configuration HTTPS (optionnel, pour le développement)
    use_https_env = os.environ.get('USE_HTTPS', 'false')
    use_https = use_https_env.lower() == 'true'
    ssl_context = None
    
    # Debug: afficher la valeur de USE_HTTPS
    print(f"[DEBUG] USE_HTTPS={use_https_env} (interprété comme: {use_https})")
    
    if use_https:
        cert_dir = os.path.join(os.path.dirname(__file__), 'certs')
        cert_file = os.path.join(cert_dir, 'cert.pem')
        key_file = os.path.join(cert_dir, 'key.pem')
        
        if os.path.exists(cert_file) and os.path.exists(key_file):
            ssl_context = (cert_file, key_file)
            print(f"[INFO] HTTPS activé avec certificat: {cert_file}")
        else:
            print(f"[ATTENTION] USE_HTTPS=true mais les certificats sont introuvables")
            print(f"[INFO] Exécutez: python generate_cert.py pour générer les certificats")
            print(f"[INFO] Démarrage en HTTP...")
            use_https = False
    
    protocol = 'https' if use_https and ssl_context else 'http'
    
    print(f"=" * 70)
    print(f"  GDR Dump (Beta) - Serveur API")
    print(f"=" * 70)
    print(f"  Serveur démarré sur {protocol}://localhost:{port}")
    print(f"  Mode debug: {debug}")
    print(f"  HTTPS: {use_https}")
    print(f"  Endpoints disponibles:")
    print(f"    - GET  /api/status")
    print(f"    - POST /api/db/dump/import")
    print(f"    - GET  /api/db/dump/status")
    print(f"    - GET  /api/db/dump/stats")
    print(f"    - GET  /api/db/dump/raw")
    print(f"    - GET  /api/db/dump/years")
    print(f"=" * 70)
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug,
        ssl_context=ssl_context
    )
