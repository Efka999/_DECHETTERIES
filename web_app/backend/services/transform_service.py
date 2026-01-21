"""
Service de transformation qui réutilise la logique existante
Wrapper autour de transform_t2_to_collectes pour l'API
"""

import sys
import os
from pathlib import Path
import tempfile
import shutil

# Ajouter le dossier scripts au path pour importer la fonction de transformation
# On cherche le dossier scripts depuis plusieurs emplacements possibles
current_file = Path(__file__).resolve()
scripts_dir = None
project_root = None

# Méthode 1 : Remonter depuis le fichier actuel (si web_app est à la racine)
# Structure attendue: _DECHETTERIES/web_app/backend/services/transform_service.py
potential_root = current_file.parent.parent.parent.parent
potential_scripts = potential_root / 'scripts'
if potential_scripts.exists() and (potential_scripts / 'transform_t2_to_collectes.py').exists():
    scripts_dir = potential_scripts
    project_root = potential_root

# Méthode 2 : Chercher depuis le répertoire de travail actuel
if scripts_dir is None:
    cwd = Path.cwd()
    # Si on est dans web_app/backend, remonter à la racine
    if 'web_app' in str(cwd):
        # Chercher le parent qui contient web_app
        current = cwd
        while current != current.parent:
            potential = current.parent / 'scripts'
            if potential.exists() and (potential / 'transform_t2_to_collectes.py').exists():
                scripts_dir = potential
                project_root = current.parent
                break
            current = current.parent
    else:
        # On est peut-être déjà à la racine
        potential = cwd / 'scripts'
        if potential.exists() and (potential / 'transform_t2_to_collectes.py').exists():
            scripts_dir = potential
            project_root = cwd

# Méthode 3 : Chercher récursivement depuis le répertoire de travail
if scripts_dir is None:
    cwd = Path.cwd()
    for parent in [cwd] + list(cwd.parents):
        potential = parent / 'scripts'
        if potential.exists() and (potential / 'transform_t2_to_collectes.py').exists():
            scripts_dir = potential
            project_root = parent
            break

# Si toujours pas trouvé, erreur
if scripts_dir is None or not scripts_dir.exists():
    raise ImportError(
        f"Dossier scripts introuvable.\n"
        f"Fichier actuel : {current_file}\n"
        f"Répertoire courant : {Path.cwd()}\n"
        f"Cherché dans : {potential_root}, {Path.cwd()}, et parents"
    )

# Vérifier que le fichier transform_t2_to_collectes.py existe
transform_file = scripts_dir / 'transform_t2_to_collectes.py'
if not transform_file.exists():
    raise ImportError(
        f"Fichier transform_t2_to_collectes.py introuvable dans {scripts_dir}"
    )

# Ajouter le dossier scripts au path Python
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

try:
    from transform_t2_to_collectes import transform_t2_to_collectes
except ImportError as e:
    raise ImportError(
        f"Impossible d'importer transform_t2_to_collectes depuis {scripts_dir} : {e}\n"
        f"Vérifiez que le fichier {transform_file} existe et est valide."
    )


def transform_excel_file(uploaded_file, output_filename=None):
    """
    Transforme un fichier Excel uploadé en format COLLECTES
    
    Args:
        uploaded_file: Fichier uploadé (Flask FileStorage)
        output_filename: Nom du fichier de sortie (optionnel)
    
    Returns:
        dict: {
            'success': bool,
            'output_path': str ou None,
            'message': str,
            'error': str ou None
        }
    """
    # Créer un dossier temporaire pour le fichier d'entrée
    temp_dir = Path(tempfile.mkdtemp(prefix='dechetteries_input_'))
    input_path = None
    output_path = None
    
    try:
        # Sauvegarder le fichier uploadé dans le dossier temporaire
        input_path = temp_dir / uploaded_file.filename
        uploaded_file.save(str(input_path))
        
        # Trouver le dossier output à la racine du projet
        # Structure: _DECHETTERIES/web_app/backend/services/transform_service.py
        # On remonte jusqu'à _DECHETTERIES
        current_file = Path(__file__).resolve()
        project_root = current_file.parent.parent.parent.parent
        output_dir = project_root / 'output'
        
        # Si pas trouvé, essayer depuis le répertoire de travail
        if not output_dir.exists():
            cwd = Path.cwd()
            # Si on est dans web_app/backend, remonter à la racine
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
        
        # Créer le dossier output s'il n'existe pas
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Définir le chemin de sortie
        if output_filename is None:
            output_filename = "COLLECTES DECHETERIES T2 2025.xlsx"
        
        output_path = output_dir / output_filename
        
        # Appeler la fonction de transformation existante
        result = transform_t2_to_collectes(
            str(input_path),
            str(output_path),
            dechetterie_filter=None,
            combine_all=True
        )
        
        # Vérifier que le fichier de sortie existe et n'est pas vide
        if output_path.exists() and output_path.stat().st_size > 0:
            # Retourner le chemin relatif depuis la racine du projet pour l'API
            # L'API pourra chercher dans output/ ou utiliser le chemin complet
            return {
                'success': True,
                'output_path': str(output_path),
                'output_filename': output_path.name,
                'output_relative_path': f'output/{output_path.name}',
                'message': 'Transformation réussie',
                'error': None
            }
        else:
            return {
                'success': False,
                'output_path': None,
                'output_filename': None,
                'message': 'La transformation a échoué',
                'error': 'Le fichier de sortie n\'a pas été créé ou est vide'
            }
            
    except FileNotFoundError as e:
        return {
            'success': False,
            'output_path': None,
            'message': 'Fichier introuvable',
            'error': str(e)
        }
    except Exception as e:
        return {
            'success': False,
            'output_path': None,
            'message': f'Erreur lors de la transformation : {str(e)}',
            'error': str(e)
        }
    finally:
        # Nettoyer le dossier temporaire d'entrée
        try:
            if input_path and input_path.exists():
                input_path.unlink()
            if temp_dir.exists():
                # Supprimer le dossier s'il est vide
                try:
                    temp_dir.rmdir()
                except:
                    pass
        except:
            pass


def cleanup_temp_file(file_path):
    """
    Nettoie un fichier temporaire et son dossier parent si vide
    
    Args:
        file_path: Chemin du fichier à supprimer
    """
    try:
        file_path_obj = Path(file_path)
        if file_path_obj.exists():
            file_path_obj.unlink()
        
        # Essayer de supprimer le dossier parent s'il est vide
        parent_dir = file_path_obj.parent
        if parent_dir.exists() and not any(parent_dir.iterdir()):
            parent_dir.rmdir()
    except Exception as e:
        # Ignorer les erreurs de nettoyage
        pass
