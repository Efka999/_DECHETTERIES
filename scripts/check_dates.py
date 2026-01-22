"""
Script pour vérifier les calculs en lisant tous les fichiers Excel d'entrée
et en ordonnant toutes les lignes de toutes les feuilles par date.

Ce script permet de vérifier que toutes les données sont bien prises en compte
et dans le bon ordre chronologique.
"""

import pandas as pd
import numpy as np
from datetime import datetime
import os
import sys
from pathlib import Path

# Configuration pour l'affichage UTF-8 sur Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

def check_duplicates_in_file(df, file_name, sheet_name=None):
    """
    Détecte les doublons dans un DataFrame et affiche les détails avec flux et poids.
    
    Args:
        df: DataFrame avec les données
        file_name: Nom du fichier source
        sheet_name: Nom de la feuille (optionnel)
        
    Returns:
        DataFrame: Lignes dupliquées avec détails
    """
    # Colonnes clés pour identifier les doublons
    key_columns = ['Date', 'Lieu collecte', 'Catégorie', 'Sous Catégorie', 'Flux']
    
    # Vérifier que toutes les colonnes clés existent
    missing_cols = [col for col in key_columns if col not in df.columns]
    if missing_cols:
        return None
    
    # Créer une copie pour la détection de doublons avec date normalisée
    df_check = df.copy()
    df_check['Date_normalized'] = pd.to_datetime(df_check['Date']).dt.normalize()
    key_columns_check = ['Date_normalized'] + [col for col in key_columns if col != 'Date']
    
    # Trouver les doublons basés sur les colonnes clés (avec date normalisée)
    duplicates_mask = df_check.duplicated(subset=key_columns_check, keep=False)
    
    if not duplicates_mask.any():
        return None
    
    # Retourner les lignes originales (pas normalisées) qui sont des doublons
    duplicates = df[duplicates_mask].copy()
    
    # Ajouter une colonne de date normalisée pour le tri et le groupby
    duplicates['Date_normalized'] = pd.to_datetime(duplicates['Date']).dt.normalize()
    sort_columns = ['Date_normalized'] + [col for col in key_columns if col != 'Date']
    duplicates = duplicates.sort_values(sort_columns)
    
    # Afficher les doublons
    source_label = f"{file_name}"
    if sheet_name:
        source_label += f" / {sheet_name}"
    
    print(f"\n   🔍 DOUBLONS DÉTECTÉS dans {source_label} : {len(duplicates)} lignes")
    
    # Grouper les doublons pour affichage
    grouped = duplicates.groupby(key_columns_check)
    
    duplicate_count = 0
    for group_key, group in grouped:
        duplicate_count += 1
        if duplicate_count > 10:  # Limiter l'affichage à 10 groupes
            remaining = len(grouped) - 10
            print(f"   ... ({remaining} autres groupes de doublons)")
            break
        
        # Extraire les valeurs du groupe (group_key est un tuple)
        date_val = group_key[0]  # Date normalisée
        lieu = group_key[1] if len(group_key) > 1 else group.iloc[0].get('Lieu collecte', 'N/A')
        categorie = group_key[2] if len(group_key) > 2 else group.iloc[0].get('Catégorie', 'N/A')
        sous_cat = group_key[3] if len(group_key) > 3 else group.iloc[0].get('Sous Catégorie', 'N/A')
        flux = group_key[4] if len(group_key) > 4 else group.iloc[0].get('Flux', 'N/A')
        
        print(f"\n   📋 Groupe de doublon #{duplicate_count}:")
        date_str = date_val.strftime('%d/%m/%Y') if pd.notna(date_val) and hasattr(date_val, 'strftime') else str(date_val)
        print(f"      Date: {date_str}")
        print(f"      Lieu: {lieu}")
        print(f"      Catégorie: {categorie}")
        print(f"      Sous-catégorie: {sous_cat}")
        print(f"      Flux: {flux}")
        print(f"      Nombre de doublons: {len(group)}")
        
        # Afficher les détails de chaque doublon avec poids
        for idx, row in group.iterrows():
            poids = row.get('Poids', 'N/A')
            poids_str = f"{poids:.2f}" if pd.notna(poids) and isinstance(poids, (int, float)) else str(poids)
            orientation = row.get('Orientation', 'N/A')
            date_orig = row.get('Date', 'N/A')
            date_orig_str = date_orig.strftime('%d/%m/%Y %H:%M:%S') if pd.notna(date_orig) and hasattr(date_orig, 'strftime') else str(date_orig)
            print(f"        → Ligne {idx+1}: Date={date_orig_str}, Poids={poids_str}, Orientation={orientation}")
    
    # Retirer la colonne temporaire avant de retourner
    duplicates = duplicates.drop(columns=['Date_normalized'])
    
    return duplicates


def read_all_input_files(input_dir='input'):
    """
    Lit tous les fichiers Excel du dossier input et extrait toutes les lignes
    avec dates de toutes les feuilles, ordonnées par date.
    Vérifie également les doublons dans chaque fichier.
    
    Args:
        input_dir: Chemin vers le dossier contenant les fichiers Excel
        
    Returns:
        DataFrame: Toutes les lignes ordonnées par date
    """
    input_path = Path(input_dir)
    if not input_path.exists():
        print(f"❌ ERREUR : Le dossier '{input_dir}' n'existe pas")
        return None
    
    # Trouver tous les fichiers Excel dans le dossier input
    excel_files = list(input_path.glob('*.xlsx')) + list(input_path.glob('*.xls'))
    
    if not excel_files:
        print(f"❌ ERREUR : Aucun fichier Excel trouvé dans '{input_dir}'")
        return None
    
    print(f"\n{'='*80}")
    print(" " * 25 + "VÉRIFICATION DES DONNÉES PAR DATE")
    print(f"{'='*80}")
    print(f"\n📁 Dossier : {input_path.absolute()}")
    print(f"📄 Fichiers Excel trouvés : {len(excel_files)}")
    
    all_rows = []
    all_duplicates = []
    
    for excel_file in sorted(excel_files):
        print(f"\n{'─'*80}")
        print(f"📄 Fichier : {excel_file.name}")
        print(f"{'─'*80}")
        
        try:
            # Lire toutes les feuilles du fichier
            excel_data = pd.ExcelFile(excel_file)
            sheet_names = excel_data.sheet_names
            print(f"   Feuilles détectées : {len(sheet_names)}")
            
            file_row_count = 0
            file_duplicates = []
            
            for sheet_name in sheet_names:
                try:
                    # Lire la feuille
                    df = pd.read_excel(excel_file, sheet_name=sheet_name)
                    
                    # Vérifier si la colonne 'Date' existe
                    if 'Date' not in df.columns:
                        print(f"   ⚠️  Feuille '{sheet_name}' : colonne 'Date' absente ({len(df)} lignes ignorées)")
                        continue
                    
                    # Filtrer les lignes avec des dates valides
                    df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
                    valid_dates = df['Date'].notna()
                    df_with_dates = df[valid_dates].copy()
                    
                    if len(df_with_dates) == 0:
                        print(f"   ⚠️  Feuille '{sheet_name}' : aucune date valide trouvée")
                        continue
                    
                    # Vérifier les doublons dans cette feuille
                    duplicates = check_duplicates_in_file(df_with_dates, excel_file.name, sheet_name)
                    if duplicates is not None and len(duplicates) > 0:
                        duplicates['Source_Fichier'] = excel_file.name
                        duplicates['Source_Feuille'] = sheet_name
                        file_duplicates.append(duplicates)
                        all_duplicates.append(duplicates)
                    
                    # Ajouter des colonnes pour identifier la source
                    df_with_dates['Source_Fichier'] = excel_file.name
                    df_with_dates['Source_Feuille'] = sheet_name
                    
                    # Ajouter à la liste globale
                    all_rows.append(df_with_dates)
                    file_row_count += len(df_with_dates)
                    
                    # Afficher les dates min/max pour cette feuille
                    min_date = df_with_dates['Date'].min()
                    max_date = df_with_dates['Date'].max()
                    print(f"   ✓ Feuille '{sheet_name}' : {len(df_with_dates)} lignes avec dates")
                    print(f"     Période : {min_date.strftime('%d/%m/%Y')} → {max_date.strftime('%d/%m/%Y')}")
                    
                except Exception as e:
                    print(f"   ❌ Erreur lors de la lecture de la feuille '{sheet_name}' : {str(e)}")
                    continue
            
            # Vérifier les doublons au niveau du fichier entier (toutes feuilles combinées)
            if len(file_duplicates) > 0:
                file_combined = pd.concat(file_duplicates, ignore_index=True)
                print(f"\n   📊 Doublons totaux dans {excel_file.name} : {len(file_combined)} lignes")
            
            print(f"\n   📊 Total pour {excel_file.name} : {file_row_count} lignes avec dates")
            
        except Exception as e:
            print(f"   ❌ Erreur lors de la lecture du fichier {excel_file.name} : {str(e)}")
            continue
    
    if not all_rows:
        print(f"\n❌ ERREUR : Aucune ligne avec date valide trouvée dans les fichiers")
        return None
    
    # Combiner toutes les lignes
    print(f"\n{'='*80}")
    print("COMBINAISON DES DONNÉES")
    print(f"{'='*80}")
    
    combined_df = pd.concat(all_rows, ignore_index=True)
    print(f"📊 Total de lignes combinées : {len(combined_df)}")
    
    # Trier par date
    combined_df = combined_df.sort_values('Date', ascending=True).reset_index(drop=True)
    
    # Afficher les statistiques
    min_date = combined_df['Date'].min()
    max_date = combined_df['Date'].max()
    print(f"📅 Période totale : {min_date.strftime('%d/%m/%Y')} → {max_date.strftime('%d/%m/%Y')}")
    
    # Compter par mois
    combined_df['Mois'] = combined_df['Date'].dt.to_period('M')
    mois_counts = combined_df['Mois'].value_counts().sort_index()
    print(f"\n📈 Répartition par mois :")
    for mois, count in mois_counts.items():
        print(f"   {mois} : {count} lignes")
    
    # Compter par fichier source
    print(f"\n📁 Répartition par fichier source :")
    file_counts = combined_df['Source_Fichier'].value_counts()
    for file, count in file_counts.items():
        print(f"   {file} : {count} lignes")
    
    # Compter par feuille source
    print(f"\n📄 Répartition par feuille source :")
    sheet_counts = combined_df.groupby(['Source_Fichier', 'Source_Feuille']).size().sort_values(ascending=False)
    for (file, sheet), count in sheet_counts.items():
        print(f"   {file} / {sheet} : {count} lignes")
    
    # Résumé des doublons
    if all_duplicates:
        print(f"\n{'='*80}")
        print("RÉSUMÉ DES DOUBLONS")
        print(f"{'='*80}")
        duplicates_combined = pd.concat(all_duplicates, ignore_index=True)
        print(f"📊 Total de lignes dupliquées : {len(duplicates_combined)}")
        
        # Compter les doublons par fichier
        print(f"\n📁 Doublons par fichier :")
        dup_file_counts = duplicates_combined['Source_Fichier'].value_counts()
        for file, count in dup_file_counts.items():
            print(f"   {file} : {count} lignes dupliquées")
        
        # Compter les doublons par flux
        if 'Flux' in duplicates_combined.columns:
            print(f"\n🔄 Doublons par flux :")
            dup_flux_counts = duplicates_combined['Flux'].value_counts()
            for flux, count in dup_flux_counts.items():
                print(f"   {flux} : {count} lignes dupliquées")
        
        # Total des poids des doublons
        if 'Poids' in duplicates_combined.columns:
            total_poids = duplicates_combined['Poids'].sum()
            print(f"\n⚖️  Poids total des doublons : {total_poids:.2f}")
    
    return combined_df, all_duplicates if all_duplicates else None


def display_sample_data(df, n=20):
    """
    Affiche un échantillon des données ordonnées par date.
    
    Args:
        df: DataFrame avec les données
        n: Nombre de lignes à afficher
    """
    if df is None or len(df) == 0:
        print("\n❌ Aucune donnée à afficher")
        return
    
    print(f"\n{'='*80}")
    print(f"AFFICHAGE D'UN ÉCHANTILLON (premières {min(n, len(df))} lignes)")
    print(f"{'='*80}")
    
    # Sélectionner les colonnes importantes à afficher
    display_columns = ['Date', 'Source_Fichier', 'Source_Feuille']
    
    # Ajouter d'autres colonnes si elles existent
    optional_columns = ['Lieu collecte', 'Catégorie', 'Sous Catégorie', 'Flux', 'Poids']
    for col in optional_columns:
        if col in df.columns:
            display_columns.append(col)
    
    sample_df = df[display_columns].head(n)
    
    # Formater les dates pour l'affichage
    sample_df_display = sample_df.copy()
    sample_df_display['Date'] = sample_df_display['Date'].dt.strftime('%d/%m/%Y')
    
    print(sample_df_display.to_string(index=True))
    
    if len(df) > n:
        print(f"\n... ({len(df) - n} lignes supplémentaires)")


def save_to_excel(df, output_file='output/verification_dates.xlsx'):
    """
    Sauvegarde les données ordonnées par date dans un fichier Excel.
    
    Args:
        df: DataFrame avec les données
        output_file: Chemin du fichier de sortie
    """
    if df is None or len(df) == 0:
        print("\n❌ Aucune donnée à sauvegarder")
        return
    
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        # Formater les dates pour Excel
        df_to_save = df.copy()
        df_to_save['Date'] = df_to_save['Date'].dt.strftime('%d/%m/%Y')
        
        # Sauvegarder
        df_to_save.to_excel(output_path, index=False, engine='openpyxl')
        print(f"\n✅ Données sauvegardées dans : {output_path.absolute()}")
        print(f"   Total : {len(df_to_save)} lignes")
        
    except Exception as e:
        print(f"\n❌ Erreur lors de la sauvegarde : {str(e)}")


def save_duplicates_to_excel(duplicates_list, output_file='output/verification_doublons.xlsx'):
    """
    Sauvegarde les doublons dans un fichier Excel.
    
    Args:
        duplicates_list: Liste de DataFrames contenant les doublons
        output_file: Chemin du fichier de sortie
    """
    if not duplicates_list or len(duplicates_list) == 0:
        print("\n❌ Aucun doublon à sauvegarder")
        return
    
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        # Combiner tous les doublons
        duplicates_combined = pd.concat(duplicates_list, ignore_index=True)
        
        # Formater les dates pour Excel
        duplicates_combined['Date'] = duplicates_combined['Date'].dt.strftime('%d/%m/%Y')
        
        # Sauvegarder
        duplicates_combined.to_excel(output_path, index=False, engine='openpyxl')
        print(f"\n✅ Doublons sauvegardés dans : {output_path.absolute()}")
        print(f"   Total : {len(duplicates_combined)} lignes dupliquées")
        
    except Exception as e:
        print(f"\n❌ Erreur lors de la sauvegarde des doublons : {str(e)}")


def main():
    """Fonction principale"""
    # Déterminer le dossier input (depuis le dossier scripts ou depuis la racine)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    input_dir = project_root / 'input'
    
    # Lire toutes les données
    result = read_all_input_files(input_dir)
    
    if result is None:
        print(f"\n{'='*80}")
        print("✅ Vérification terminée")
        print(f"{'='*80}\n")
        return
    
    if isinstance(result, tuple):
        df, duplicates_list = result
    else:
        df = result
        duplicates_list = None
    
    if df is not None:
        # Afficher un échantillon
        display_sample_data(df, n=30)
        
        # Proposer de sauvegarder
        print(f"\n{'='*80}")
        save_option = input("\n💾 Voulez-vous sauvegarder les données dans un fichier Excel ? (o/n) : ")
        if save_option.lower() in ['o', 'oui', 'y', 'yes']:
            output_file = project_root / 'output' / 'verification_dates.xlsx'
            save_to_excel(df, output_file)
            
            # Proposer de sauvegarder les doublons
            if duplicates_list:
                save_dup_option = input("\n💾 Voulez-vous sauvegarder les doublons dans un fichier séparé ? (o/n) : ")
                if save_dup_option.lower() in ['o', 'oui', 'y', 'yes']:
                    dup_output_file = project_root / 'output' / 'verification_doublons.xlsx'
                    save_duplicates_to_excel(duplicates_list, dup_output_file)
        else:
            print("   Données non sauvegardées")
    
    print(f"\n{'='*80}")
    print("✅ Vérification terminée")
    print(f"{'='*80}\n")


if __name__ == "__main__":
    main()
