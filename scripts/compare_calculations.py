"""
Script de diagnostic pour comparer les calculs entre le backend et le script Excel.

Ce script compare les totaux calculés par :
1. Le backend (depuis la base de données dump)
2. Le script synthesize_dump.py (depuis le fichier Excel directement)
"""

import pandas as pd
import sys
import os
from pathlib import Path

# Add project root to path
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
server_dir = os.path.join(project_root, 'server')
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(server_dir))
sys.path.insert(0, str(script_dir))

# Change to server directory for imports
original_cwd = os.getcwd()
os.chdir(server_dir)

try:
    from services.dump_stats_service import build_stats_from_dump_db
    from services.db import get_dump_connection, init_dump_db
finally:
    os.chdir(original_cwd)

from transform_collectes import map_category_to_collectes, DECHETTERIE_MAPPING


def _map_dechetterie(lieu_collecte):
    """Map lieu_collecte to standard déchetterie name (same as synthesize_dump.py)"""
    if pd.isna(lieu_collecte) or str(lieu_collecte).strip() == '':
        return 'Pépinière'
    
    lieu_str = str(lieu_collecte).strip()
    
    if lieu_str.upper() in ['APPORT VOLONTAIRE', 'APPORT SUR SITE']:
        return 'Pépinière'
    
    if lieu_str.upper() in ['NAN', '']:
        return 'Pépinière'
    
    mapped = DECHETTERIE_MAPPING.get(lieu_str)
    if mapped:
        return mapped
    
    return lieu_str


def get_backend_totals(year=2025):
    """Get totals from backend (database)"""
    print("\n" + "="*70)
    print("CALCULS BACKEND (depuis la base de données)")
    print("="*70)
    
    result = build_stats_from_dump_db(year)
    
    if not result['success']:
        print(f"❌ Erreur backend: {result.get('error', 'Unknown error')}")
        return None
    
    stats = result['stats']
    global_totals = stats['global_totals']
    
    # Calculate total from categories
    category_columns = ['MEUBLES', 'ELECTRO', 'DEMANTELEMENT', 'CHINE',
                       'VAISSELLE', 'JOUETS', 'PAPETERIE', 'LIVRES', 'MASSICOT',
                       'CADRES', 'ASL', 'PUERICULTURE', 'ABJ', 'CD/DVD/K7', 'PMCB',
                       'MERCERIE', 'TEXTILE', 'AUTRES']
    
    total_categories = sum(global_totals.get(cat, 0) for cat in category_columns)
    
    print(f"\nTotal catégories (kg): {total_categories:,.0f}")
    print(f"Total catégories (tonnes): {total_categories/1000:,.2f}")
    
    # Show diagnostic info if available
    if '_diagnostic' in stats:
        diag = stats['_diagnostic']
        print(f"\n[DIAGNOSTIC BACKEND]")
        print(f"  Total brut (tonnes): {diag.get('total_brut_tonnes', 0):,.2f}")
        print(f"  Total après mapping (tonnes): {diag.get('total_apres_mapping_tonnes', 0):,.2f}")
        print(f"  Total AUTRES (tonnes): {diag.get('total_autres_tonnes', 0):,.2f}")
        print(f"  Total final calculé (tonnes): {diag.get('total_final_calcule_tonnes', 0):,.2f}")
        print(f"  Total déchets ultimes (tonnes): {diag.get('total_dechets_ultimes_tonnes', 0):,.2f}")
    
    # Show totals by déchetterie
    print(f"\n[Totaux par déchetterie (backend)]")
    for dech_name, dech_data in stats['dechetteries'].items():
        dech_total_dict = dech_data.get('total', {})
        dech_total = dech_total_dict.get('TOTAL', 0) if isinstance(dech_total_dict, dict) else (dech_total_dict if isinstance(dech_total_dict, (int, float)) else 0)
        print(f"  {dech_name}: {dech_total/1000:,.2f} tonnes")
    
    return {
        'total_categories_kg': total_categories,
        'total_categories_tonnes': total_categories / 1000,
        'global_totals': global_totals,
        'dechetteries': stats['dechetteries'],
        'diagnostic': stats.get('_diagnostic', {})
    }


def get_script_totals(year=2025):
    """Get totals from script (direct Excel reading)"""
    print("\n" + "="*70)
    print("CALCULS SCRIPT (depuis le fichier Excel directement)")
    print("="*70)
    
    # Get input file
    project_root = Path(script_dir).parent
    input_dir = project_root / 'input'
    input_file = input_dir / f"{year}_Analyse Catégories.xlsx"
    
    if not input_file.exists():
        print(f"❌ Fichier introuvable: {input_file}")
        return None
    
    # Read Excel file
    try:
        excel_file = pd.ExcelFile(input_file)
        sheet_name = 'A' if 'A' in excel_file.sheet_names else excel_file.sheet_names[0]
        df = pd.read_excel(input_file, sheet_name=sheet_name)
        print(f"   Fichier: {input_file.name}")
        print(f"   Feuille: {sheet_name}")
        print(f"   Lignes lues: {len(df)}")
    except Exception as e:
        print(f"❌ Erreur lecture: {e}")
        return None
    
    # Check required columns
    required_columns = ['Catégorie', 'Flux', 'Poids', 'Date', 'Lieu collecte']
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        print(f"❌ Colonnes manquantes: {', '.join(missing_columns)}")
        return None
    
    # Process data (same as synthesize_dump.py)
    total_brut = df['Poids'].sum() if 'Poids' in df.columns else 0
    print(f"\nTotal brut (kg): {total_brut:,.0f}")
    print(f"Total brut (tonnes): {total_brut/1000:,.2f}")
    
    # Convert date
    df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
    df = df[df['Date'].notna()].copy()
    total_apres_date = df['Poids'].sum() if 'Poids' in df.columns else 0
    print(f"Total après filtre date (tonnes): {total_apres_date/1000:,.2f}")
    
    # Map déchetterie
    df['Dechetterie'] = df['Lieu collecte'].apply(_map_dechetterie)
    
    # Map category
    df['MappedCategory'] = df.apply(
        lambda row: map_category_to_collectes(
            row.get('Catégorie'),
            row.get('Sous Catégorie'),
            row.get('Flux'),
            row.get('Orientation')
        ),
        axis=1
    )
    df['MappedCategory'] = df['MappedCategory'].fillna('AUTRES')
    
    # Convert poids to numeric
    df['Poids'] = pd.to_numeric(df['Poids'], errors='coerce')
    df = df[df['Poids'].notna()].copy()
    total_apres_poids = df['Poids'].sum()
    print(f"Total après filtre poids (tonnes): {total_apres_poids/1000:,.2f}")
    
    # Calculate totals by category
    category_columns = ['MEUBLES', 'ELECTRO', 'DEMANTELEMENT', 'CHINE',
                       'VAISSELLE', 'JOUETS', 'PAPETERIE', 'LIVRES', 'MASSICOT',
                       'CADRES', 'ASL', 'PUERICULTURE', 'ABJ', 'CD/DVD/K7', 'PMCB',
                       'MERCERIE', 'TEXTILE', 'AUTRES']
    
    category_totals = {}
    for cat in category_columns:
        cat_df = df[df['MappedCategory'] == cat]
        category_totals[cat] = cat_df['Poids'].sum()
    
    total_categories = sum(category_totals.values())
    
    print(f"\nTotal catégories (kg): {total_categories:,.0f}")
    print(f"Total catégories (tonnes): {total_categories/1000:,.2f}")
    
    # Show totals by déchetterie
    print(f"\n[Totaux par déchetterie (script)]")
    dechetterie_totals = df.groupby('Dechetterie')['Poids'].sum()
    for dech, total in dechetterie_totals.items():
        print(f"  {dech}: {total/1000:,.2f} tonnes")
    
    return {
        'total_brut_kg': total_brut,
        'total_brut_tonnes': total_brut / 1000,
        'total_apres_date_tonnes': total_apres_date / 1000,
        'total_apres_poids_tonnes': total_apres_poids / 1000,
        'total_categories_kg': total_categories,
        'total_categories_tonnes': total_categories / 1000,
        'category_totals': category_totals,
        'dechetterie_totals': dict(dechetterie_totals)
    }


def compare_results(backend_result, script_result):
    """Compare backend and script results"""
    print("\n" + "="*70)
    print("COMPARAISON DES RÉSULTATS")
    print("="*70)
    
    if backend_result is None or script_result is None:
        print("❌ Impossible de comparer: données manquantes")
        return
    
    # Compare totals
    backend_total = backend_result['total_categories_tonnes']
    script_total = script_result['total_categories_tonnes']
    difference = abs(backend_total - script_total)
    percent_diff = (difference / backend_total * 100) if backend_total > 0 else 0
    
    print(f"\n[COMPARAISON TOTAUX]")
    print(f"  Backend:  {backend_total:,.2f} tonnes")
    print(f"  Script:   {script_total:,.2f} tonnes")
    print(f"  Différence: {difference:,.2f} tonnes ({percent_diff:.2f}%)")
    
    if difference < 0.01:
        print("  [OK] Les totaux sont identiques")
    elif difference < 1:
        print("  [WARN] Petite difference (< 1 tonne)")
    else:
        print("  [ERROR] Difference significative (> 1 tonne)")
    
    # Compare by déchetterie
    print(f"\n[COMPARAISON PAR DÉCHETTERIE]")
    backend_dech = backend_result.get('dechetteries', {})
    script_dech = script_result.get('dechetterie_totals', {})
    
    all_dechetteries = set(list(backend_dech.keys()) + list(script_dech.keys()))
    
    for dech in sorted(all_dechetteries):
        backend_dech_data = backend_dech.get(dech, {})
        backend_total_dict = backend_dech_data.get('total', {}) if isinstance(backend_dech_data, dict) else {}
        backend_total = backend_total_dict.get('TOTAL', 0) if isinstance(backend_total_dict, dict) else (backend_total_dict if isinstance(backend_total_dict, (int, float)) else 0)
        backend_val = backend_total / 1000
        
        script_val = script_dech.get(dech, 0) / 1000 if dech in script_dech else 0
        diff = abs(backend_val - script_val)
        
        if diff < 0.01:
            status = "[OK]"
        elif diff < 0.5:
            status = "[WARN]"
        else:
            status = "[ERROR]"
        
        print(f"  {status} {dech}: Backend={backend_val:,.2f}t, Script={script_val:,.2f}t, Diff={diff:,.2f}t")
    
    # Recommendations
    print(f"\n[RECOMMANDATIONS]")
    if difference < 0.01:
        print("  [OK] Les deux methodes donnent des resultats identiques.")
        print("  [OK] Les deux sont fiables.")
    else:
        print("  [WARN] Il y a des differences entre les deux methodes.")
        print("\n  Le BACKEND est probablement plus fiable car:")
        print("    - Il utilise des donnees validees lors de l'import")
        print("    - Il peut exclure des lignes avec des erreurs")
        print("    - Il a des logs detailles pour le diagnostic")
        print("    - Il gere mieux les cas limites (dates invalides, etc.)")
        print("    - Il separe les flux finaux (MASSICOT, DEMANTELEMENT) pour eviter double comptage")
        print("\n  Le SCRIPT lit directement depuis le fichier Excel:")
        print("    - Plus simple mais moins de validation")
        print("    - Peut inclure des donnees invalides")
        print("    - Pas de filtrage des erreurs d'import")
        print("    - Ne separe pas les flux finaux comme le backend")


if __name__ == "__main__":
    import sys
    
    year = 2025
    if len(sys.argv) > 1:
        try:
            year = int(sys.argv[1])
        except ValueError:
            print(f"⚠️  Année invalide: {sys.argv[1]}. Utilisation de 2025.")
    
    print("="*70)
    print(" " * 20 + "DIAGNOSTIC DES CALCULS")
    print("="*70)
    print(f"\nComparaison des calculs pour l'année {year}")
    print("="*70)
    
    backend_result = get_backend_totals(year)
    script_result = get_script_totals(year)
    
    compare_results(backend_result, script_result)
    
    print("\n" + "="*70)
