"""
Compare les totaux calculés (frontend/backend/script) avec la dernière ligne du dump Excel.

Ce script:
1. Lit la dernière ligne du fichier dump Excel (input/2025_Analyse Catégories.xlsx)
2. Compare avec les totaux du backend (depuis la DB)
3. Compare avec les totaux du script synthesize_dump.py
4. Identifie les différences et leurs causes
"""

import pandas as pd
import sys
import os
from pathlib import Path

# Add project root to path
current_file = Path(__file__).resolve()
project_root = current_file.parent.parent
server_dir = project_root / 'server'
scripts_dir = project_root / 'scripts'

if str(server_dir) not in sys.path:
    sys.path.insert(0, str(server_dir))
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

from services.dump_stats_service import build_stats_from_dump_db
from services.db import get_dump_connection, init_dump_db


def read_dump_last_row(year=2025):
    """Read the last row of the dump Excel file (should be the total row)."""
    input_dir = project_root / 'input'
    dump_file = input_dir / f"{year}_Analyse Catégories.xlsx"
    
    if not dump_file.exists():
        print(f"[ERREUR] Fichier dump introuvable: {dump_file}")
        return None
    
    print(f"\n{'='*70}")
    print("LECTURE DU FICHIER DUMP EXCEL")
    print(f"{'='*70}")
    print(f"Fichier: {dump_file}")
    
    try:
        # Read the Excel file
        df = pd.read_excel(dump_file, sheet_name=None)
        
        # Get all sheets
        sheet_names = list(df.keys())
        print(f"\nFeuilles trouvées: {sheet_names}")
        
        # Read the last row of each sheet
        last_rows = {}
        for sheet_name in sheet_names:
            sheet_df = df[sheet_name]
            if len(sheet_df) > 0:
                last_row = sheet_df.iloc[-1]
                last_rows[sheet_name] = last_row
                print(f"\n[Feuille: {sheet_name}]")
                print(f"  Nombre de lignes: {len(sheet_df)}")
                print(f"  Dernière ligne (index {len(sheet_df)-1}):")
                
                # Try to find a 'poids' or 'Poids' column
                poids_col = None
                for col in sheet_df.columns:
                    if 'poids' in str(col).lower():
                        poids_col = col
                        break
                
                if poids_col:
                    total_poids = last_row[poids_col]
                    print(f"  Total Poids (dernière ligne): {total_poids:,.2f} kg ({total_poids/1000:,.2f} tonnes)")
                else:
                    # Show all numeric columns
                    print(f"  Colonnes numériques de la dernière ligne:")
                    for col in sheet_df.columns:
                        val = last_row[col]
                        if pd.notna(val) and isinstance(val, (int, float)):
                            print(f"    {col}: {val:,.2f}")
        
        # Also try to sum all 'poids' columns from all rows (except last row if it's a total)
        print(f"\n{'='*70}")
        print("CALCUL DU TOTAL BRUT (somme de toutes les lignes)")
        print(f"{'='*70}")
        
        total_brut_all_sheets = 0
        for sheet_name in sheet_names:
            sheet_df = df[sheet_name]
            if poids_col:
                # Sum all rows except the last one (which might be a total)
                data_rows = sheet_df.iloc[:-1] if len(sheet_df) > 1 else sheet_df
                sheet_total = data_rows[poids_col].sum()
                total_brut_all_sheets += sheet_total
                print(f"  {sheet_name}: {sheet_total:,.2f} kg ({sheet_total/1000:,.2f} tonnes)")
            else:
                # Try to find numeric columns and sum them
                for col in sheet_df.columns:
                    if 'poids' in str(col).lower():
                        data_rows = sheet_df.iloc[:-1] if len(sheet_df) > 1 else sheet_df
                        sheet_total = data_rows[col].sum()
                        total_brut_all_sheets += sheet_total
                        print(f"  {sheet_name} ({col}): {sheet_total:,.2f} kg ({sheet_total/1000:,.2f} tonnes)")
                        break
        
        print(f"\n  TOTAL BRUT (toutes feuilles, toutes lignes): {total_brut_all_sheets:,.2f} kg ({total_brut_all_sheets/1000:,.2f} tonnes)")
        
        return {
            'last_rows': last_rows,
            'total_brut': total_brut_all_sheets,
            'poids_col': poids_col
        }
        
    except Exception as e:
        print(f"[ERREUR] Impossible de lire le fichier dump: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def get_backend_totals(year=2025):
    """Get totals from backend (database)."""
    print(f"\n{'='*70}")
    print("CALCULS BACKEND (depuis la base de données)")
    print(f"{'='*70}")
    
    result = build_stats_from_dump_db(year)
    
    if not result['success']:
        print(f"[ERREUR] Backend: {result.get('error', 'Unknown error')}")
        return None
    
    stats = result['stats']
    global_totals = stats['global_totals']
    
    # Get TOTAL from global_totals
    total_backend = global_totals.get('TOTAL', 0)
    
    print(f"\nTotal backend (TOTAL): {total_backend:,.2f} kg ({total_backend/1000:,.2f} tonnes)")
    
    # Show diagnostic info if available
    if '_diagnostic' in stats:
        diag = stats['_diagnostic']
        print(f"\n[DIAGNOSTIC BACKEND]")
        print(f"  Total brut (tonnes): {diag.get('total_brut_tonnes', 0):,.2f}")
        print(f"  Total après mapping (tonnes): {diag.get('total_apres_mapping_tonnes', 0):,.2f}")
        print(f"  Total AUTRES (tonnes): {diag.get('total_autres_tonnes', 0):,.2f}")
        print(f"  Total final calculé (tonnes): {diag.get('total_final_calcule_tonnes', 0):,.2f}")
        print(f"  Total déchets ultimes (tonnes): {diag.get('total_dechets_ultimes_tonnes', 0):,.2f}")
    
    # Also get raw total from DB
    init_dump_db(year)
    with get_dump_connection(year) as conn:
        df_raw = pd.read_sql("SELECT SUM(poids) as total FROM raw_dump", conn)
        total_raw_db = df_raw['total'].iloc[0] if not df_raw.empty else 0
        print(f"\n  Total brut DB (somme directe): {total_raw_db:,.2f} kg ({total_raw_db/1000:,.2f} tonnes)")
    
    return {
        'total_backend': total_backend,
        'total_raw_db': total_raw_db,
        'diagnostic': stats.get('_diagnostic', {})
    }


def compare_totals(dump_data, backend_data, year=2025):
    """Compare all totals and identify differences."""
    print(f"\n{'='*70}")
    print("COMPARAISON DES TOTAUX")
    print(f"{'='*70}")
    
    if not dump_data or not backend_data:
        print("[ERREUR] Données manquantes pour la comparaison")
        return
    
    total_dump = dump_data.get('total_brut', 0)
    total_backend = backend_data.get('total_backend', 0)
    total_raw_db = backend_data.get('total_raw_db', 0)
    
    print(f"\n1. Total du dump Excel (somme de toutes les lignes):")
    print(f"   {total_dump:,.2f} kg ({total_dump/1000:,.2f} tonnes)")
    
    print(f"\n2. Total brut DB (somme directe depuis raw_dump):")
    print(f"   {total_raw_db:,.2f} kg ({total_raw_db/1000:,.2f} tonnes)")
    
    print(f"\n3. Total backend (TOTAL après mapping et filtres):")
    print(f"   {total_backend:,.2f} kg ({total_backend/1000:,.2f} tonnes)")
    
    # Compare dump vs raw DB
    diff_dump_db = total_dump - total_raw_db
    print(f"\n{'='*70}")
    print("DIFFERENCES")
    print(f"{'='*70}")
    print(f"\nDump Excel vs DB brute:")
    print(f"  Différence: {diff_dump_db:,.2f} kg ({diff_dump_db/1000:,.2f} tonnes)")
    if abs(diff_dump_db) < 1:
        print(f"  [OK] Les totaux sont identiques (différence < 1 kg)")
    else:
        print(f"  [ATTENTION] Différence significative détectée")
        print(f"  Cela peut indiquer:")
        print(f"    - Des lignes exclues lors de l'import")
        print(f"    - Des erreurs de lecture du fichier Excel")
        print(f"    - Des différences de format de données")
    
    # Compare raw DB vs backend
    diff_db_backend = total_raw_db - total_backend
    print(f"\nDB brute vs Backend (après filtres):")
    print(f"  Différence: {diff_db_backend:,.2f} kg ({diff_db_backend/1000:,.2f} tonnes)")
    if abs(diff_db_backend) < 1:
        print(f"  [OK] Pas de perte lors du traitement")
    else:
        print(f"  [INFO] Données filtrées/exclues par le backend:")
        diag = backend_data.get('diagnostic', {})
        total_brut = diag.get('total_brut_tonnes', 0) * 1000
        total_final = diag.get('total_final_calcule_tonnes', 0) * 1000
        excluded = total_brut - total_final
        print(f"    - Total brut: {total_brut:,.2f} kg")
        print(f"    - Total final: {total_final:,.2f} kg")
        print(f"    - Exclu: {excluded:,.2f} kg ({excluded/1000:,.2f} tonnes)")
        print(f"  Raisons possibles:")
        print(f"    - Dates invalides")
        print(f"    - Catégories non mappées (AUTRES)")
        print(f"    - Filtres de validation")
    
    # Compare dump vs backend
    diff_dump_backend = total_dump - total_backend
    print(f"\nDump Excel vs Backend (final):")
    print(f"  Différence: {diff_dump_backend:,.2f} kg ({diff_dump_backend/1000:,.2f} tonnes)")
    print(f"  Cette différence est la somme des deux différences ci-dessus")
    
    # Recommendations
    print(f"\n{'='*70}")
    print("RECOMMANDATIONS")
    print(f"{'='*70}")
    print(f"\nPour que les totaux correspondent:")
    print(f"  1. Le total du dump Excel devrait être égal au total brut DB")
    print(f"  2. Le total brut DB devrait être égal au total backend + données exclues")
    print(f"  3. Le frontend affiche le total backend (TOTAL), qui exclut les données filtrées")
    print(f"\nSi vous voulez que le frontend affiche le total du dump:")
    print(f"  - Il faudrait utiliser le total brut DB au lieu de TOTAL")
    print(f"  - Mais cela inclurait des données potentiellement invalides (dates invalides, etc.)")


if __name__ == "__main__":
    year = 2025
    if len(sys.argv) > 1:
        try:
            year = int(sys.argv[1])
        except ValueError:
            print(f"Année invalide: {sys.argv[1]}. Utilisation de 2025 par défaut.")
    
    print("="*70)
    print(" " * 15 + "COMPARAISON AVEC TOTAL DUMP")
    print("="*70)
    print(f"\nAnnée: {year}")
    
    # Read dump file
    dump_data = read_dump_last_row(year)
    
    # Get backend totals
    backend_data = get_backend_totals(year)
    
    # Compare
    if dump_data and backend_data:
        compare_totals(dump_data, backend_data, year)
    
    print(f"\n{'='*70}\n")
