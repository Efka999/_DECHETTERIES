"""
Transform data from T2 Excel file in 'input' folder
into summary format matching 'COLLECTES DECHETERIES T2 2025.xlsx'

This script processes data from ALL déchetteries for T2 period (Juillet-Décembre)
and generates a formatted Excel file.
"""

import pandas as pd
import numpy as np
from datetime import datetime
import os
import sys
from pathlib import Path

# Import the transformation functions from the existing script
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from transform_collectes import (
    transform_to_collectes,
    DECHETTERIE_MAPPING
)

if __name__ == "__main__":
    print("="*70)
    print(" " * 15 + "TRANSFORMATION T2 (Deuxième semestre)")
    print("="*70)
    print("\nCe script transforme les données T2 en format COLLECTES")
    print("pour présentation client.\n")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    input_dir = os.path.join(project_root, 'input')
    output_dir = os.path.join(project_root, 'output')
    
    # Créer les dossiers si nécessaire
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    
    # Chercher le fichier T2 dans le dossier input
    input_file = None
    excel_extensions = ['.xlsx', '.xls']
    
    if os.path.exists(input_dir):
        for file in os.listdir(input_dir):
            file_path = os.path.join(input_dir, file)
            if os.path.isfile(file_path):
                _, ext = os.path.splitext(file)
                if ext.lower() in excel_extensions:
                    file_upper = file.upper()
                    if 'T2' in file_upper and '25' in file_upper:
                        input_file = file_path
                        break
    
    # Vérifier que le fichier d'entrée existe
    if input_file is None or not os.path.exists(input_file):
        print(f"\n{'='*70}")
        print("ERREUR : Aucun fichier T2 trouve dans le dossier 'input' !")
        print(f"{'='*70}")
        print(f"\nLe dossier 'input' doit contenir un fichier Excel T2 (.xlsx ou .xls)")
        print(f"  Dossier recherche : {input_dir}")
        print(f"\nVÉRIFICATIONS :")
        print(f"  1. Y a-t-il un fichier Excel T2 dans le dossier 'input' ?")
        print(f"  2. Le fichier n'est-il pas ouvert dans Excel ?")
        print(f"  3. Le fichier contient-il 'T2' et '25' dans son nom ?")
        print(f"{'='*70}\n")
        sys.exit(1)
    
    # Nom du fichier de sortie
    output_file = os.path.join(output_dir, "COLLECTES DECHETERIES T2 2025.xlsx")
    
    print(f"Fichier d'entrée  : {input_file}")
    print(f"Fichier de sortie : {output_file}")
    print(f"\nTraitement en cours...\n")
    
    try:
        result = transform_to_collectes(input_file, output_file, None, combine_all=True)
        
        if result is not None:
            print(f"\n{'='*70}")
            print(" " * 25 + "SUCCES !")
            print(f"{'='*70}")
            print(f"\nLe fichier a ete cree avec succes :")
            print(f"  {output_file}")
            print(f"\nCe fichier contient :")
            print(f"  - Toutes les dechetteries sur une seule feuille")
            print(f"  - Les totaux pour chaque dechetterie")
            print(f"  - Les statistiques et pourcentages")
            print(f"  - Le formatage professionnel (couleurs, bordures)")
            print(f"\nVous pouvez maintenant ouvrir ce fichier dans Excel.")
            print(f"{'='*70}\n")
        else:
            print(f"\n{'='*70}")
            print(" " * 25 + "ERREUR")
            print(f"{'='*70}")
            print(f"\nLa transformation a echoue.")
            print(f"Verifiez les messages d'erreur ci-dessus.")
            print(f"{'='*70}\n")
            sys.exit(1)
            
    except FileNotFoundError as e:
        print(f"\n{'='*70}")
        print("ERREUR : Fichier introuvable")
        print(f"{'='*70}")
        print(f"\n{str(e)}")
        print(f"\nVerifiez que tous les fichiers necessaires sont dans le bon dossier.")
        print(f"{'='*70}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n{'='*70}")
        print("ERREUR : Une erreur inattendue s'est produite")
        print(f"{'='*70}")
        print(f"\nType d'erreur : {type(e).__name__}")
        print(f"Message : {str(e)}")
        print(f"\nSi le problème persiste, contactez le support technique.")
        print(f"{'='*70}\n")
        sys.exit(1)
