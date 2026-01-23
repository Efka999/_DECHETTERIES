"""
Service de transformation qui réutilise la logique existante
Wrapper autour de transform_collectes pour l'API
"""

import sys
from pathlib import Path
import tempfile
import shutil

# Ajouter le dossier scripts au path pour importer la fonction de transformation
# On cherche le dossier scripts depuis plusieurs emplacements possibles
current_file = Path(__file__).resolve()
scripts_dir = None
project_root = None

# Méthode 1 : Remonter depuis le fichier actuel
# Structure attendue: _DECHETTERIES/server/services/transform_service.py
potential_root = current_file.parent.parent.parent
potential_scripts = potential_root / 'scripts'
if potential_scripts.exists() and (potential_scripts / 'transform_collectes.py').exists():
    scripts_dir = potential_scripts
    project_root = potential_root

# Méthode 2 : Chercher depuis le répertoire de travail actuel
if scripts_dir is None:
    cwd = Path.cwd()
    # Si on est dans server, remonter à la racine
    if 'server' in str(cwd):
        # Chercher le parent qui contient server
        current = cwd
        while current != current.parent:
            potential = current.parent / 'scripts'
            if potential.exists() and (potential / 'transform_collectes.py').exists():
                scripts_dir = potential
                project_root = current.parent
                break
            current = current.parent
    else:
        # On est peut-être déjà à la racine
        potential = cwd / 'scripts'
        if potential.exists() and (potential / 'transform_collectes.py').exists():
            scripts_dir = potential
            project_root = cwd

# Méthode 3 : Chercher récursivement depuis le répertoire de travail
if scripts_dir is None:
    cwd = Path.cwd()
    for parent in [cwd] + list(cwd.parents):
        potential = parent / 'scripts'
        if potential.exists() and (potential / 'transform_collectes.py').exists():
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

# Vérifier que le fichier transform_collectes.py existe
transform_file = scripts_dir / 'transform_collectes.py'
if not transform_file.exists():
    raise ImportError(
        f"Fichier transform_collectes.py introuvable dans {scripts_dir}"
    )

# Ajouter le dossier scripts au path Python
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

try:
    from transform_collectes import transform_to_collectes
except ImportError as e:
    raise ImportError(
        f"Impossible d'importer le module de transformation depuis {scripts_dir} : {e}\n"
        f"Vérifiez que le fichier transform_collectes.py existe et est valide."
    )


def _get_project_paths():
    """Helper function to get project root, input, and output directories"""
    # Méthode 1 : Depuis le fichier actuel
    current_file = Path(__file__).resolve()
    # Structure: _DECHETTERIES/server/services/transform_service.py
    potential_root = current_file.parent.parent.parent
    
    # Vérifier si ce chemin contient le dossier output
    if (potential_root / 'output').exists():
        project_root = potential_root
    else:
        # Méthode 2 : Depuis le répertoire de travail actuel
        cwd = Path.cwd()
        project_root = None
        
        # Chercher récursivement depuis le répertoire courant
        current = cwd
        while current != current.parent:
            # Vérifier si ce répertoire contient output/ et scripts/
            if (current / 'output').exists() and (current / 'scripts').exists():
                project_root = current
                break
            # Vérifier aussi par nom de dossier
            if current.name == '_DECHETTERIES' and (current / 'output').exists():
                project_root = current
                break
            current = current.parent
        
        # Méthode 3 : Fallback sur le répertoire courant si output existe
        if project_root is None:
            if (cwd / 'output').exists():
                project_root = cwd
            else:
                # Dernier recours : utiliser le chemin calculé depuis le fichier
                project_root = potential_root
    
    input_dir = project_root / 'input'
    output_dir = project_root / 'output'
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Log pour déboguer (peut être retiré en production)
    import logging
    logger = logging.getLogger(__name__)
    logger.debug(f"Project root: {project_root}")
    logger.debug(f"Output dir: {output_dir}")
    logger.debug(f"Output dir exists: {output_dir.exists()}")
    if output_dir.exists():
        files = list(output_dir.glob('*.xlsx'))
        logger.debug(f"Files in output: {[f.name for f in files]}")
    
    return project_root, input_dir, output_dir


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
        
        # Trouver les dossiers du projet
        project_root, input_dir, output_dir = _get_project_paths()
        
        # Copier le fichier uploadé dans le dossier input pour traitement ultérieur
        # Cela permet de détecter T1 et T2 pour la génération annuelle
        try:
            input_dir.mkdir(parents=True, exist_ok=True)
            permanent_input_path = input_dir / uploaded_file.filename
            shutil.copy2(str(input_path), str(permanent_input_path))
        except Exception as e:
            # Si la copie échoue, continuer quand même avec le fichier temporaire
            print(f"Warning: Could not copy file to input directory: {e}")
        
        # Déterminer le nom du fichier de sortie basé sur le nom du fichier d'entrée
        if output_filename is None:
            # Détecter si c'est T1 ou T2 basé sur le nom du fichier
            input_filename_upper = uploaded_file.filename.upper()
            if 'T1' in input_filename_upper:
                output_filename = "COLLECTES DECHETERIES T1 2025.xlsx"
            elif 'T2' in input_filename_upper:
                output_filename = "COLLECTES DECHETERIES T2 2025.xlsx"
            else:
                # Par défaut, utiliser T2
                output_filename = "COLLECTES DECHETERIES T2 2025.xlsx"
        
        output_path = output_dir / output_filename
        
        # Appeler la fonction de transformation existante
        result = transform_to_collectes(
            str(input_path),
            str(output_path),
            dechetterie_filter=None,
            combine_all=True
        )
        
        # Vérifier que le fichier de sortie existe et n'est pas vide
        if output_path.exists() and output_path.stat().st_size > 0:
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
