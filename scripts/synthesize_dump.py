"""
Synthétise le fichier dump déposé dans 'input' en un fichier Excel au format COLLECTES.

Ce script lit le fichier dump (2025_Analyse Catégories.xlsx) depuis le dossier 'input'
et génère un fichier Excel synthétisé dans le dossier 'output'.
"""

import pandas as pd
import numpy as np
from datetime import datetime
import os
from pathlib import Path
from openpyxl import load_workbook
from openpyxl.styles import PatternFill, Border, Side, Alignment, Font
from openpyxl.utils import get_column_letter

# Import mapping functions from transform_collectes
import sys
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

from mappings import DECHETTERIE_MAPPING, map_category_to_collectes


def _get_project_paths():
    """Get project root, input, and output directories."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    input_dir = os.path.join(project_root, 'input')
    output_dir = os.path.join(project_root, 'output')
    return project_root, input_dir, output_dir


def synthesize_dump(output_file, year=2025):
    """
    Synthétise les données dump depuis la base de données en un fichier Excel au format COLLECTES.
    
    Le fichier généré contient les données agrégées par déchetterie et par mois,
    avec des formules Excel pour les totaux et statistiques.
    
    Les données sont lues depuis la base de données dump (même source que le backend),
    garantissant des calculs identiques au frontend.
    
    Args:
        output_file: Path for output file
        year: Year for the dump (default: 2025)
    """
    
    print(f"\n{'='*70}")
    print(" " * 20 + "SYNTHESE DUMP EN COURS")
    print(f"{'='*70}")
    
    # Import database functions
    import sys
    current_file = Path(__file__).resolve()
    project_root = current_file.parent.parent
    server_dir = project_root / 'server'
    if str(server_dir) not in sys.path:
        sys.path.insert(0, str(server_dir))
    
    try:
        from services.db import get_dump_connection, init_dump_db
    except ImportError:
        print(f"\n[ERREUR] Impossible d'importer les fonctions de base de données")
        return None
    
    # Initialize database
    print(f"\n[LECTURE] Lecture depuis la base de données dump-{year}.db...")
    try:
        init_dump_db(year)
        with get_dump_connection(year) as conn:
            df = pd.read_sql(
                """
                SELECT date, lieu_collecte, categorie, sous_categorie, flux, orientation, poids
                FROM raw_dump
                """,
                conn
            )
        print(f"   [OK] {len(df)} enregistrements lus depuis la base de données")
    except Exception as e:
        print(f"\n[ERREUR] Impossible de lire la base de données : {str(e)}")
        return None
    
    if df.empty:
        print(f"\n[ERREUR] Aucune donnée dans la base de données")
        return None
    
    # Prepare data (same processing as backend)
    print(f"\n[TRAITEMENT] Traitement des données...")
    
    # Convert date
    df['Date'] = pd.to_datetime(df['date'], errors='coerce')
    total_avant_date = df['poids'].sum() / 1000
    df = df[df['Date'].notna()].copy()
    total_apres_date = df['poids'].sum() / 1000 if not df.empty else 0
    print(f"   Total avant filtre date: {total_avant_date:,.2f} tonnes")
    print(f"   Total après filtre date: {total_apres_date:,.2f} tonnes")
    
    # Map déchetterie (same as backend)
    df['Dechetterie'] = df['lieu_collecte'].map(DECHETTERIE_MAPPING)
    df['Dechetterie'] = df['Dechetterie'].fillna(df['lieu_collecte'])
    # Attribuer les lieux de collecte vides à Pépinière
    empty_mask = df['lieu_collecte'].isna() | (df['lieu_collecte'].astype(str).str.strip() == '')
    df.loc[empty_mask, 'Dechetterie'] = 'Pépinière'
    # Attribuer "APPORT VOLONTAIRE" et "APPORT SUR SITE" à Pépinière
    apport_mask = (
        df['lieu_collecte'].astype(str).str.upper().eq('APPORT VOLONTAIRE') |
        df['lieu_collecte'].astype(str).str.upper().eq('APPORT SUR SITE')
    )
    df.loc[apport_mask, 'Dechetterie'] = 'Pépinière'
    # Attribuer toutes les lignes sans déchetterie (NaN ou chaîne "nan") à Pépinière
    nan_mask = (
        df['Dechetterie'].isna() |
        (df['Dechetterie'].astype(str).str.upper().str.strip().eq('NAN')) |
        (df['Dechetterie'].astype(str).str.upper().str.strip().eq(''))
    )
    df.loc[nan_mask, 'Dechetterie'] = 'Pépinière'
    
    # Map category (same as backend)
    df['MappedCategory'] = df.apply(
        lambda row: map_category_to_collectes(
            row['categorie'],
            row['sous_categorie'],
            row['flux'],
            row['orientation']
        ),
        axis=1
    )
    
    # Fill NaN categories with AUTRES (same as backend)
    df.loc[df['MappedCategory'].isna(), 'MappedCategory'] = 'AUTRES'
    
    # Rename poids column
    df['Poids'] = df['poids']
    
    # Extract month
    month_names_fr = {
        1: 'JANVIER', 2: 'FEVRIER', 3: 'MARS', 4: 'AVRIL',
        5: 'MAI', 6: 'JUIN', 7: 'JUILLET', 8: 'AOUT',
        9: 'SEPTEMBRE', 10: 'OCTOBRE', 11: 'NOVEMBRE', 12: 'DECEMBRE'
    }
    df['Month'] = df['Date'].dt.month
    df['MonthName'] = df['Month'].map(month_names_fr)
    df = df[df['MonthName'].notna()].copy()
    
    date_start = df['Date'].min()
    date_end = df['Date'].max()
    date_range_str = f"{date_start.strftime('%d/%m/%Y')} - {date_end.strftime('%d/%m/%Y')}"
    
    unique_dechetteries = df['Dechetterie'].unique().tolist()
    
    print(f"   Période : {date_range_str}")
    print(f"   Déchetteries : {len(unique_dechetteries)}")
    print(f"   Catégories : {df['MappedCategory'].nunique()}")
    
    # Order déchetteries: standard first, then special cases
    standard_order = ['Pépinière', 'Sanssac', 'St Germain', 'Polignac']
    special_cases = [d for d in unique_dechetteries if d not in standard_order]
    ordered_dechetteries = [d for d in standard_order if d in unique_dechetteries] + sorted(special_cases)
    
    print(f"   Traitement de {len(ordered_dechetteries)} déchetteries...")
    
    # Standard columns (same as transform_collectes.py)
    category_columns = ['MEUBLES', 'ELECTRO', 'DEMANTELEMENT', 'CHINE',
                       'VAISSELLE', 'JOUETS', 'PAPETERIE', 'LIVRES', 'MASSICOT',
                       'CADRES', 'ASL', 'PUERICULTURE', 'ABJ', 'CD/DVD/K7','MERCERIE', 'TEXTILE']
    
    month_order = ['JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
                   'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE']
    
    all_sections = []
    grand_totals = {col: 0 for col in category_columns}
    grand_totals['TOTAL'] = 0
    grand_totals['sans massicot et démantèlement'] = 0
    
    # Track row numbers for each déchetterie's total row (for formulas)
    dechetterie_total_rows = {}
    dechetterie_start_rows = {}
    current_row = 4  # Start after header row
    
    # Process each déchetterie
    for dech in ordered_dechetteries:
        dech_df = df[df['Dechetterie'] == dech].copy()
        
        if len(dech_df) == 0:
            continue
        
        # Group by month and category
        summary = dech_df.groupby(['MonthName', 'MappedCategory'])['Poids'].sum().reset_index()
        
        # Pivot
        pivot_df = summary.pivot_table(
            index='MonthName',
            columns='MappedCategory',
            values='Poids',
            aggfunc='sum',
            fill_value=0
        ).reset_index()
        
        # Reorder months
        ordered_df = pd.DataFrame({'MonthName': month_order})
        result_df = ordered_df.merge(pivot_df, on='MonthName', how='left')
        result_df = result_df.fillna(0)
        
        # Add header row with déchetterie name
        dechetterie_header = dech.upper()
        # Header row: déchetterie name + categories + TOTAL + sans massicot + empty + DECHETS ULTIMES + empty
        header_row = [dechetterie_header] + category_columns + ['TOTAL', 'Sans massicot et démantèlement', '', 'DECHETS ULTIMES', '']
        all_sections.append(('header', header_row))
        dechetterie_start_rows[dech] = current_row
        current_row += 1  # Header row
        
        # Add data rows
        data_start_row = current_row
        for _, row in result_df.iterrows():
            data_row = [row['MonthName']]
            row_total = 0
            for col in category_columns:
                val = row[col] if col in row else 0
                data_row.append(val)
                if isinstance(val, (int, float)):
                    row_total += val
                    grand_totals[col] += val
            
            # TOTAL column
            data_row.append(row_total)
            grand_totals['TOTAL'] += row_total
            
            # sans massicot
            massicot = row.get('MASSICOT', 0) if 'MASSICOT' in row else 0
            demantelement = row.get('DEMANTELEMENT', 0) if 'DEMANTELEMENT' in row else 0
            sans_massicot = row_total - massicot - demantelement
            data_row.append(sans_massicot)
            grand_totals['sans massicot et démantèlement'] += sans_massicot
            
            # Empty columns (U, V, W) - V (index 21) reserved for DECHETS ULTIMES
            data_row.extend(['', '', ''])
            
            all_sections.append(('data', data_row))
            current_row += 1
        
        # Calculate DECHETS ULTIMES for this déchetterie by month
        # EVACUATION DECHETS with orientation DECHETS ULTIMES (same as backend)
        ultimes_df = dech_df[
            (dech_df['categorie'].astype(str).str.upper().str.strip().eq('EVACUATION DECHETS')) &
            (dech_df['orientation'].astype(str).str.upper().str.strip().eq('DECHETS ULTIMES'))
        ].copy()
        
        # Add DECHETS ULTIMES to totals (to match dump Excel total)
        if len(ultimes_df) > 0:
            # Group by month
            ultimes_summary = ultimes_df.groupby('MonthName')['Poids'].sum().reset_index()
            ultimes_dict = {}
            for _, ult_row in ultimes_summary.iterrows():
                month = ult_row['MonthName']
                ultimes_dict[month] = ult_row['Poids']
            all_sections.append(('ultimes', (dech, ultimes_dict)))
            
            # Add DECHETS ULTIMES to grand totals
            total_ultimes = ultimes_df['Poids'].sum()
            grand_totals['TOTAL'] += total_ultimes
        
        # Add total row for this déchetterie (formulas will be added later)
        total_row = ['Total']
        data_end_row = current_row - 1
        total_row_num = current_row
        dechetterie_total_rows[dech] = total_row_num
        
        # Add placeholder formulas (will be updated after writing to Excel)
        # We'll use temporary values that will be replaced
        for col_idx, col in enumerate(category_columns, start=2):
            total_row.append('')  # Placeholder, will be formula
        
        # TOTAL column placeholder
        total_row.append('')  # Placeholder
        # sans massicot placeholder
        total_row.append('')  # Placeholder
        # Columns U, V, W (V reserved for DECHETS ULTIMES total)
        total_row.extend(['', '', ''])
        all_sections.append(('total', total_row))
        current_row += 1
        
        # Empty row after each section
        all_sections.append(('empty', [''] * 23))
        current_row += 1
    
    # Create Excel file with all sections
    print(f"\n[ECRITURE] Ecriture du fichier Excel...")
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        # Title row
        title_text = f"COLLECTES DECHETTERIES {date_range_str}"
        title_row = [[title_text] + [''] * 22]
        
        # Empty row (row 2) - no longer needed for "sans massicot et démantèlement"
        empty_row = [[''] * 23]
        
        # Combine all rows and track row positions
        all_rows = title_row + empty_row
        row_positions = {}  # Track where each déchetterie's data starts/ends
        ultimes_data = {}  # Track DECHETS ULTIMES by déchetterie and month
        
        # Build rows and track positions
        current_excel_row = len(all_rows) + 1  # Excel row numbers (1-based)
        current_dechetterie = None
        current_data_start = None
        
        for section_type, row_data in all_sections:
            if section_type == 'header':
                # Find which déchetterie this is
                dech_name = row_data[0] if row_data else ''
                # Find matching déchetterie
                for dech in ordered_dechetteries:
                    if dech.upper() == dech_name:
                        row_positions[dech] = {'header_row': current_excel_row, 'data_start': current_excel_row + 1}
                        current_dechetterie = dech
                        current_data_start = current_excel_row + 1
                        break
                all_rows.append(row_data[:23])
                current_excel_row += 1
            elif section_type == 'data':
                all_rows.append(row_data[:23])
                current_excel_row += 1
            elif section_type == 'total':
                # Find which déchetterie this total belongs to
                for dech in reversed(ordered_dechetteries):
                    if dech in row_positions and 'total_row' not in row_positions[dech]:
                        row_positions[dech]['total_row'] = current_excel_row
                        # data_end is the last data row (before this total row)
                        row_positions[dech]['data_end'] = current_excel_row - 1
                        break
                all_rows.append(row_data[:23])
                current_excel_row += 1
            elif section_type == 'ultimes':
                # Store ultimes data
                dech, ultimes_dict = row_data
                ultimes_data[dech] = ultimes_dict
            else:  # empty
                all_rows.append(row_data[:23])
                current_excel_row += 1
        
        # Now update DECHETS ULTIMES in data rows and add to row totals
        month_order = ['JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
                       'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE']
        
        # Helper function to normalize names (remove accents for comparison)
        def normalize_name(name):
            """Normalize name by removing accents for comparison"""
            if not name:
                return ''
            name_upper = str(name).upper().strip()
            replacements = {
                'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
                'À': 'A', 'Â': 'A', 'Ä': 'A',
                'Ù': 'U', 'Û': 'U', 'Ü': 'U',
                'Î': 'I', 'Ï': 'I',
                'Ô': 'O', 'Ö': 'O',
                'Ç': 'C'
            }
            for accented, unaccented in replacements.items():
                name_upper = name_upper.replace(accented, unaccented)
            return name_upper
        
        current_dechetterie = None
        start_idx = len(title_row + empty_row)
        
        for idx in range(start_idx, len(all_rows)):
            row = all_rows[idx]
            if not row or len(row) < 22:
                continue
                
            # Check if it's a header row (déchetterie name)
            if row[0] and isinstance(row[0], str):
                row0_normalized = normalize_name(row[0])
                # Check if it matches a déchetterie name
                for dech in ordered_dechetteries:
                    dech_normalized = normalize_name(dech)
                    if dech_normalized == row0_normalized:
                        current_dechetterie = dech
                        break
                continue
            
            # Check if it's a month row
            if row[0] and isinstance(row[0], str):
                row0_upper = str(row[0]).upper().strip()
                if row0_upper in [m.upper() for m in month_order]:
                    if current_dechetterie and current_dechetterie in ultimes_data:
                        month = row0_upper
                        if month in ultimes_data[current_dechetterie]:
                            ultimes_value = ultimes_data[current_dechetterie][month]
                            all_rows[idx][21] = ultimes_value  # Column 22 (index 21)
                            # Add DECHETS ULTIMES to TOTAL column (index 18, column S)
                            if isinstance(row[18], (int, float)):
                                all_rows[idx][18] = row[18] + ultimes_value
                            elif row[18] == '' or row[18] is None:
                                all_rows[idx][18] = ultimes_value
                continue
        
        # Add empty rows before statistics
        for _ in range(3):
            all_rows.append([''] * 23)
            current_excel_row += 1
        
        # Add grand total row - sum of all déchetterie totals (formulas will be added later)
        # Note: grand_totals['TOTAL'] already includes DECHETS ULTIMES (added above)
        grand_total_row = ['TOTAL']
        # Placeholders for formulas (will be updated after writing to Excel)
        for col_idx, col in enumerate(category_columns, start=2):
            grand_total_row.append('')  # Placeholder
        
        # TOTAL column placeholder (will include DECHETS ULTIMES via formula)
        grand_total_row.append('')  # Placeholder
        grand_total_row.append('')  # sans massicot placeholder
        # Columns U, V, W (V reserved for DECHETS ULTIMES total)
        grand_total_row.extend(['', '', ''])
        all_rows.append(grand_total_row[:23])
        
        # Add empty row
        all_rows.append([''] * 23)
        
        # Add percentage rows for each déchetterie (PEP, POL, STG, SAN, etc.)
        # Formulas will be added later after we know grand_total_row_num
        dech_abbrev = {
            'Pépinière': 'PEP',
            'Polignac': 'POL',
            'St Germain': 'STG',
            'Sanssac': 'SAN',
            'Yssingeaux': 'YSS',
            'Bas-en-basset': 'BAS',
            'Monistrol': 'MON'
        }
        
        for dech in ordered_dechetteries:
            if dech in row_positions and 'total_row' in row_positions[dech] and dech in dech_abbrev:
                abbrev = dech_abbrev[dech]
                percent_row = [abbrev]
                # Placeholders for formulas (will be updated after writing to Excel)
                for col_idx, col in enumerate(category_columns, start=2):
                    percent_row.append('')  # Placeholder
                percent_row.extend([''] * 5)  # Fill remaining columns
                all_rows.append(percent_row[:23])
        
        # Add empty rows
        for _ in range(2):
            all_rows.append([''] * 23)
        
        # Add summary rows
        # TOTAL COLLECTES X DECHETTERIES
        summary_row1 = [''] * 4 + ['TOTAL COLLECTES'] + [''] + [str(len(ordered_dechetteries))] + [''] * 15
        all_rows.append(summary_row1[:23])
        
        # Empty row
        all_rows.append([''] * 23)
        
        # DECHETS ULTIMES rows (placeholder - user can fill manually)
        ultimes_row1 = [''] * 4 + ['DECHETS ULTIMES T1'] + [''] + [''] + [''] * 15
        ultimes_row2 = [''] * 4 + ['DECHETS ULTIMES T2'] + [''] + [''] + [''] * 15
        all_rows.append(ultimes_row1[:23])
        all_rows.append(ultimes_row2[:23])
        
        # Empty rows
        for _ in range(2):
            all_rows.append([''] * 23)
        
        # MASSICOT and DEMANTELEMENT summary rows (formulas will be added later)
        massicot_row = [''] * 4 + ['MASSICOT'] + [''] + [''] + [''] * 15  # Placeholder
        demantelement_row = [''] * 4 + ['DEMANTELEMENT'] + [''] + [''] + [''] * 15  # Placeholder
        all_rows.append(massicot_row[:23])
        all_rows.append(demantelement_row[:23])
        
        # Write to Excel (only one sheet: CALCUL POIDS)
        final_df = pd.DataFrame(all_rows)
        final_df.to_excel(writer, sheet_name='CALCUL POIDS', index=False, header=False)
    
    # Now update formulas in the Excel file with correct row numbers
    print("   [OK] Mise à jour des formules...")
    wb = load_workbook(output_file)
    sheet_names = ['CALCUL POIDS'] if 'CALCUL POIDS' in wb.sheetnames else []

    # Helper function to normalize names (remove accents for comparison)
    def normalize_name(name):
        """Normalize name by removing accents for comparison"""
        if not name:
            return ''
        name_upper = str(name).upper().strip()
        replacements = {
            'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
            'À': 'A', 'Â': 'A', 'Ä': 'A',
            'Ù': 'U', 'Û': 'U', 'Ü': 'U',
            'Î': 'I', 'Ï': 'I',
            'Ô': 'O', 'Ö': 'O',
            'Ç': 'C'
        }
        for accented, unaccented in replacements.items():
            name_upper = name_upper.replace(accented, unaccented)
        return name_upper

    # Rebuild row_positions with actual Excel row numbers
    actual_row_positions = {}
    grand_total_row_num = None
    
    for sheet_name in sheet_names:
        ws = wb[sheet_name]
        
        # First pass: identify all row positions
        current_dechetterie = None
        month_order = ['JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
                       'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE']
        
        for row_idx in range(1, ws.max_row + 1):
            cell_a = ws.cell(row=row_idx, column=1)
            if not cell_a.value:
                continue
            
            cell_a_str = str(cell_a.value).strip()
            cell_a_normalized = normalize_name(cell_a_str)
            
            # Check if it's a déchetterie header
            for dech in ordered_dechetteries:
                dech_normalized = normalize_name(dech)
                if dech_normalized == cell_a_normalized:
                    current_dechetterie = dech
                    if dech not in actual_row_positions:
                        actual_row_positions[dech] = {}
                    actual_row_positions[dech]['header_row'] = row_idx
                    actual_row_positions[dech]['data_start'] = row_idx + 1
                    break
            
            # Check if it's a month row (first month for this déchetterie)
            if cell_a_str.upper() in [m.upper() for m in month_order]:
                if current_dechetterie and current_dechetterie in actual_row_positions:
                    if 'data_start' not in actual_row_positions[current_dechetterie] or actual_row_positions[current_dechetterie]['data_start'] > row_idx:
                        actual_row_positions[current_dechetterie]['data_start'] = row_idx
                    # Update data_end as we find each month
                    actual_row_positions[current_dechetterie]['data_end'] = row_idx
            
            # Check if it's a total row for a déchetterie (exact match "Total")
            if cell_a_str.upper() == 'TOTAL' and current_dechetterie and current_dechetterie in actual_row_positions:
                # This is a déchetterie total row (not grand total)
                actual_row_positions[current_dechetterie]['total_row'] = row_idx
                # data_end should already be set from the last month row, but ensure it's set
                if 'data_end' not in actual_row_positions[current_dechetterie]:
                    # Find last month row before this total
                    for prev_row in range(row_idx - 1, actual_row_positions[current_dechetterie].get('data_start', row_idx - 12) - 1, -1):
                        prev_cell = ws.cell(row=prev_row, column=1)
                        if prev_cell.value and str(prev_cell.value).strip().upper() in [m.upper() for m in month_order]:
                            actual_row_positions[current_dechetterie]['data_end'] = prev_row
                            break
                current_dechetterie = None  # Reset after finding total
            
            # Check if it's the grand total row (TOTAL without a déchetterie context)
            if cell_a_str.upper() == 'TOTAL' and row_idx > 50 and not current_dechetterie:
                # Check if this row has formulas that reference multiple déchetterie totals
                cell_b = ws.cell(row=row_idx, column=2)
                # Grand total is usually after all déchetterie sections
                # Check if previous rows had déchetterie totals
                has_dechetterie_totals_before = False
                for prev_row in range(max(1, row_idx - 100), row_idx):
                    prev_cell = ws.cell(row=prev_row, column=1)
                    if prev_cell.value and str(prev_cell.value).strip().upper() == 'TOTAL':
                        has_dechetterie_totals_before = True
                        break
                
                if has_dechetterie_totals_before:
                    grand_total_row_num = row_idx
        
        # Second pass: update formulas with correct row numbers
        print(f"   [OK] Mise à jour des formules ({sheet_name})...")
        
        # Update déchetterie total formulas
        for dech in ordered_dechetteries:
            if dech not in actual_row_positions or 'total_row' not in actual_row_positions[dech]:
                continue
            
            total_row_num = actual_row_positions[dech]['total_row']
            data_start = actual_row_positions[dech].get('data_start')
            data_end = actual_row_positions[dech].get('data_end')
            
            if not data_start or not data_end:
                # Try to find data_start and data_end by looking for month rows
                header_row = actual_row_positions[dech].get('header_row', total_row_num - 15)
                for row_idx in range(header_row + 1, total_row_num):
                    cell_a = ws.cell(row=row_idx, column=1)
                    if cell_a.value and str(cell_a.value).strip().upper() in [m.upper() for m in month_order]:
                        if not data_start:
                            data_start = row_idx
                        data_end = row_idx
                
                if not data_start:
                    data_start = total_row_num - 12
                if not data_end:
                    data_end = total_row_num - 1
            
            # Update category column formulas
            for col_idx, col in enumerate(category_columns, start=2):
                col_letter = get_column_letter(col_idx)
                cell = ws.cell(row=total_row_num, column=col_idx)
                cell.value = f'=SUM({col_letter}{data_start}:{col_letter}{data_end})'
            
            # Update TOTAL column formula (includes categories + DECHETS ULTIMES)
            col_start = get_column_letter(2)
            col_end = get_column_letter(18)
            cell = ws.cell(row=total_row_num, column=19)
            # TOTAL = sum of categories + sum of DECHETS ULTIMES
            cell.value = f'=SUM({col_start}{total_row_num}:{col_end}{total_row_num})+SUM(V{data_start}:V{data_end})'
            
            # Update sans massicot formula
            cell = ws.cell(row=total_row_num, column=20)
            cell.value = f'=S{total_row_num}-J{total_row_num}-D{total_row_num}'
            
            # Update DECHETS ULTIMES formula (for display in column V)
            cell = ws.cell(row=total_row_num, column=22)
            cell.value = f'=SUM(V{data_start}:V{data_end})'
        
        # Update grand total formulas
        if grand_total_row_num:
            # Update category column formulas
            for col_idx, col in enumerate(category_columns, start=2):
                col_letter = get_column_letter(col_idx)
                formula_parts = []
                for dech in ordered_dechetteries:
                    if dech in actual_row_positions and 'total_row' in actual_row_positions[dech]:
                        formula_parts.append(f'{col_letter}{actual_row_positions[dech]["total_row"]}')
                if formula_parts:
                    cell = ws.cell(row=grand_total_row_num, column=col_idx)
                    cell.value = '=' + '+'.join(formula_parts)
                else:
                    cell = ws.cell(row=grand_total_row_num, column=col_idx)
                    cell.value = 0
            
            # Update TOTAL column formula (includes categories + DECHETS ULTIMES)
            col_start = get_column_letter(2)
            col_end = get_column_letter(18)
            # Get DECHETS ULTIMES total
            ultimes_formula_parts = []
            for dech in ordered_dechetteries:
                if dech in actual_row_positions and 'total_row' in actual_row_positions[dech]:
                    ultimes_formula_parts.append(f'V{actual_row_positions[dech]["total_row"]}')
            if ultimes_formula_parts:
                # TOTAL = sum of categories + sum of DECHETS ULTIMES
                cell = ws.cell(row=grand_total_row_num, column=19)
                cell.value = f'=SUM({col_start}{grand_total_row_num}:{col_end}{grand_total_row_num})+SUM(' + ','.join(ultimes_formula_parts) + ')'
            else:
                cell = ws.cell(row=grand_total_row_num, column=19)
                cell.value = f'=SUM({col_start}{grand_total_row_num}:{col_end}{grand_total_row_num})'
            
            # Update DECHETS ULTIMES formula (for display in column V)
            if ultimes_formula_parts:
                cell = ws.cell(row=grand_total_row_num, column=22)
                cell.value = '=' + '+'.join(ultimes_formula_parts)
            else:
                cell = ws.cell(row=grand_total_row_num, column=22)
                cell.value = 0
            
            # Update MASSICOT and DEMANTELEMENT summary rows
            massicot_col = get_column_letter(10)  # Column J
            demantelement_col = get_column_letter(4)  # Column D
            for row_idx in range(grand_total_row_num + 1, ws.max_row + 1):
                cell_e = ws.cell(row=row_idx, column=5)
                if cell_e.value and isinstance(cell_e.value, str):
                    if cell_e.value.strip().upper() == 'MASSICOT':
                        cell_g = ws.cell(row=row_idx, column=7)
                        cell_g.value = f'={massicot_col}{grand_total_row_num}'
                    elif cell_e.value.strip().upper() == 'DEMANTELEMENT':
                        cell_g = ws.cell(row=row_idx, column=7)
                        cell_g.value = f'={demantelement_col}{grand_total_row_num}'
            
            # Update percentage row formulas
            dech_abbrev = {
                'Pépinière': 'PEP',
                'Polignac': 'POL',
                'St Germain': 'STG',
                'Sanssac': 'SAN',
                'Yssingeaux': 'YSS',
                'Bas-en-basset': 'BAS',
                'Monistrol': 'MON'
            }
            
            for row_idx in range(grand_total_row_num + 1, ws.max_row + 1):
                cell_a = ws.cell(row=row_idx, column=1)
                if cell_a.value and isinstance(cell_a.value, str):
                    abbrev = cell_a.value.upper()
                    # Find matching déchetterie
                    for dech in ordered_dechetteries:
                        if dech in dech_abbrev and dech_abbrev[dech] == abbrev:
                            if dech in actual_row_positions and 'total_row' in actual_row_positions[dech]:
                                total_row_num = actual_row_positions[dech]['total_row']
                                # Update percentage formulas
                                for col_idx, col in enumerate(category_columns, start=2):
                                    col_letter = get_column_letter(col_idx)
                                    cell = ws.cell(row=row_idx, column=col_idx)
                                    cell.value = f'={col_letter}{total_row_num}/{col_letter}{grand_total_row_num}'
                                    cell.number_format = '0.00%'
                            break
        
        # Update DECHETS ULTIMES in data rows
        if ultimes_data:
            print(f"   [OK] Mise à jour des données DECHETS ULTIMES ({sheet_name})...")
            current_dechetterie = None
            
            for row_idx in range(1, ws.max_row + 1):
                cell_a = ws.cell(row=row_idx, column=1)
                if not cell_a.value:
                    continue
                
                cell_a_str = str(cell_a.value)
                cell_a_normalized = normalize_name(cell_a_str)
                
                # Check if it's a déchetterie header
                for dech in ordered_dechetteries:
                    dech_normalized = normalize_name(dech)
                    if dech_normalized == cell_a_normalized:
                        current_dechetterie = dech
                        break
                
                # Check if it's a month row
                if cell_a_str.upper() in [m.upper() for m in month_order]:
                    if current_dechetterie and current_dechetterie in ultimes_data:
                        month = cell_a_str.upper()
                        if month in ultimes_data[current_dechetterie]:
                            cell_v = ws.cell(row=row_idx, column=22)
                            cell_v.value = ultimes_data[current_dechetterie][month]

    wb.save(output_file)
    wb.close()
    
    # Apply formatting (same as transform_collectes.py)
    # Note: We pass actual_row_positions instead of row_positions for formatting
    print("   [OK] Application du formatage (couleurs, bordures)...")
    _apply_formatting_to_combined_file(output_file, len(ordered_dechetteries), len(month_order), actual_row_positions, ordered_dechetteries)
    
    print(f"\n   [OK] Fichier créé avec succès !")
    return df


def _apply_formatting_to_combined_file(output_file, num_dechetteries, num_months, actual_row_positions, ordered_dechetteries):
    """Apply formatting to combined file with multiple déchetteries - improved design"""
    wb = load_workbook(output_file)
    
    # Define improved border styles
    thin_border = Border(
        left=Side(style='thin', color='CCCCCC'),
        right=Side(style='thin', color='CCCCCC'),
        top=Side(style='thin', color='CCCCCC'),
        bottom=Side(style='thin', color='CCCCCC')
    )
    
    medium_border = Border(
        left=Side(style='medium', color='666666'),
        right=Side(style='medium', color='666666'),
        top=Side(style='medium', color='666666'),
        bottom=Side(style='medium', color='666666')
    )
    
    thick_border = Border(
        left=Side(style='thick', color='333333'),
        right=Side(style='thick', color='333333'),
        top=Side(style='thick', color='333333'),
        bottom=Side(style='thick', color='333333')
    )
    
    # Improved header style - darker, more professional
    header_fill = PatternFill(start_color='4472C4', end_color='4472C4', fill_type='solid')  # Professional blue
    header_font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
    header_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    
    # Improved déchetterie colors - more modern and harmonious
    dechetterie_colors = {
        'Pépinière': 'E2F0D9',  # Soft green
        'Sanssac': 'FFF4CC',     # Soft yellow
        'St Germain': 'DEEBF7',  # Soft blue
        'Polignac': 'FCE4D6',    # Soft peach
        'Yssingeaux': 'E1D5E7',  # Soft lavender
        'Bas-en-basset': 'FBE5D6', # Soft apricot
        'Monistrol': 'D5E8D4',   # Soft mint
    }
    
    # Improved gray for special columns
    gray_fill = PatternFill(start_color='E7E6E6', end_color='E7E6E6', fill_type='solid')
    
    # Standard data fill - lighter, more subtle
    data_fill_default = PatternFill(start_color='F2F2F2', end_color='F2F2F2', fill_type='solid')
    data_font = Font(name='Calibri', size=10, bold=False, color='000000')
    data_alignment = Alignment(horizontal='center', vertical='center')
    
    # Month row style - subtle highlight
    month_fill = PatternFill(start_color='D9E1F2', end_color='D9E1F2', fill_type='solid')
    month_font = Font(name='Calibri', size=10, bold=True, color='000000')
    month_alignment = Alignment(horizontal='center', vertical='center')
    
    # Total row style - more prominent
    total_fill = PatternFill(start_color='B4C6E7', end_color='B4C6E7', fill_type='solid')  # Medium blue
    total_font = Font(name='Calibri', size=11, bold=True, color='000000')
    total_alignment = Alignment(horizontal='center', vertical='center')
    
    # Grand total style - even more prominent
    grand_total_fill = PatternFill(start_color='8FAADC', end_color='8FAADC', fill_type='solid')  # Darker blue
    grand_total_font = Font(name='Calibri', size=12, bold=True, color='FFFFFF')
    grand_total_alignment = Alignment(horizontal='center', vertical='center')
    
    # Category columns order
    category_columns = ['MEUBLES', 'ELECTRO', 'DEMANTELEMENT', 'CHINE',
                       'VAISSELLE', 'JOUETS', 'PAPETERIE', 'LIVRES', 'MASSICOT',
                       'CADRES', 'ASL', 'PUERICULTURE', 'ABJ', 'CD/DVD/K7', 'MERCERIE', 'TEXTILE']
    
    # Find column indices for DEMANTELEMENT (index 2, column D) and MASSICOT (index 8, column J)
    demantelement_col_idx = 4  # Column D
    massicot_col_idx = 10      # Column J
    
    for sheet_name in ['CALCUL POIDS']:
        if sheet_name not in wb.sheetnames:
            continue
            
        ws = wb[sheet_name]
        
        # Format title row (row 1) - make it more prominent
        title_fill = PatternFill(start_color='2F5597', end_color='2F5597', fill_type='solid')  # Dark blue
        title_font = Font(name='Calibri', size=14, bold=True, color='FFFFFF')
        title_alignment = Alignment(horizontal='center', vertical='center')
        
        # Merge cells for title row (A1 to W1 to cover all columns)
        ws.merge_cells('A1:W1')
        ws.row_dimensions[1].height = 30
        
        # Format the merged cell
        cell = ws.cell(row=1, column=1)
        cell.fill = title_fill
        cell.font = title_font
        cell.alignment = title_alignment
        
        # Set row heights
        ws.row_dimensions[2].height = 12
        ws.row_dimensions[3].height = 20
        
        # Format Row 3 (main header) - includes all header columns
        for col in range(1, 19):  # Category columns
            cell = ws.cell(row=3, column=col)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_alignment
            cell.border = thin_border
        
        # TOTAL column (19)
        cell = ws.cell(row=3, column=19)
        if cell.value:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_alignment
            cell.border = thin_border
        
        # Sans massicot et démantèlement column (20)
        cell = ws.cell(row=3, column=20)
        if cell.value:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_alignment
            cell.border = thin_border
        
        # DECHETS ULTIMES column (22)
        cell = ws.cell(row=3, column=22)
        if cell.value:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_alignment
            cell.border = thin_border
        
        # Format all data rows
        current_dechetterie = None
        current_dechetterie_color = None
        
        # Helper function to normalize déchetterie names
        def normalize_dechetterie_name(name):
            """Normalize déchetterie name for matching"""
            if not name:
                return ''
            name_upper = str(name).upper().strip()
            replacements = {
                'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
                'À': 'A', 'Â': 'A', 'Ä': 'A',
                'Ù': 'U', 'Û': 'U', 'Ü': 'U',
                'Î': 'I', 'Ï': 'I',
                'Ô': 'O', 'Ö': 'O',
                'Ç': 'C'
            }
            for accented, unaccented in replacements.items():
                name_upper = name_upper.replace(accented, unaccented)
            return name_upper
        
        for row_idx in range(4, ws.max_row + 1):
            cell_a = ws.cell(row=row_idx, column=1)
            val_a = cell_a.value
            
            if val_a is None or val_a == '':
                continue
            
            val_str = str(val_a).upper()
            
            # Check if it's a déchetterie header
            val_normalized = normalize_dechetterie_name(val_a)
            found_dechetterie = None
            for dech in ordered_dechetteries:
                dech_normalized = normalize_dechetterie_name(dech)
                if dech_normalized == val_normalized:
                    found_dechetterie = dech
                    break
            
            if found_dechetterie:
                # Header row - format all columns with improved style
                current_dechetterie = found_dechetterie
                current_dechetterie_color = dechetterie_colors.get(found_dechetterie, 'F2F2F2')
                dechetterie_header_fill = PatternFill(start_color='8FAADC', end_color='8FAADC', fill_type='solid')  # Medium blue
                dechetterie_header_font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
                data_fill = PatternFill(start_color=current_dechetterie_color, end_color=current_dechetterie_color, fill_type='solid')
                
                # Format all header columns (1-19: categories + TOTAL, 20: sans massicot, 22: DECHETS ULTIMES)
                for col in range(1, 20):  # Categories + TOTAL
                    cell = ws.cell(row=row_idx, column=col)
                    cell.fill = dechetterie_header_fill
                    cell.font = dechetterie_header_font
                    cell.alignment = header_alignment
                    cell.border = thin_border
                
                # Column 20: Sans massicot et démantèlement
                cell = ws.cell(row=row_idx, column=20)
                if cell.value:
                    cell.fill = dechetterie_header_fill
                    cell.font = dechetterie_header_font
                    cell.alignment = header_alignment
                    cell.border = thin_border
                
                # Column 22: DECHETS ULTIMES
                cell = ws.cell(row=row_idx, column=22)
                if cell.value:
                    cell.fill = dechetterie_header_fill
                    cell.font = dechetterie_header_font
                    cell.alignment = header_alignment
                    cell.border = thin_border
                
                ws.row_dimensions[row_idx].height = 18
                continue
            
            # Check if it's a month name
            if val_str in ['JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE']:
                # Month row - improved styling
                cell_a.fill = month_fill
                cell_a.font = month_font
                cell_a.alignment = month_alignment
                cell_a.border = thin_border
                ws.row_dimensions[row_idx].height = 18
                
                # Use current déchetterie color, or default
                if current_dechetterie_color:
                    data_fill = PatternFill(start_color=current_dechetterie_color, end_color=current_dechetterie_color, fill_type='solid')
                else:
                    data_fill = data_fill_default
                
                # Data columns (2-18, but column 1 is month name)
                for col in range(2, 19):
                    cell = ws.cell(row=row_idx, column=col)
                    val = cell.value
                    if val is not None and val != '':
                        # Gray for DEMANTELEMENT (col 4) and MASSICOT (col 10)
                        if col == demantelement_col_idx or col == massicot_col_idx:
                            cell.fill = gray_fill
                        else:
                            cell.fill = data_fill
                        cell.font = data_font
                        cell.alignment = data_alignment
                        cell.border = thin_border
                
                # TOTAL column (includes categories + DECHETS ULTIMES)
                cell = ws.cell(row=row_idx, column=19)
                if cell.value is not None and cell.value != '':
                    col_start = get_column_letter(2)
                    col_end = get_column_letter(18)
                    # TOTAL = sum of categories + DECHETS ULTIMES (column V)
                    cell.value = f'=SUM({col_start}{row_idx}:{col_end}{row_idx})+V{row_idx}'
                    cell.fill = total_fill
                    cell.font = total_font
                    cell.alignment = total_alignment
                    cell.border = thin_border
                
                # sans massicot
                cell = ws.cell(row=row_idx, column=20)
                if cell.value is not None and cell.value != '':
                    cell.value = f'=S{row_idx}-J{row_idx}-D{row_idx}'
                    cell.font = total_font
                    cell.alignment = total_alignment
                    cell.border = thin_border
                
                continue
            
            # Check if it's a total row (exact match "Total" for déchetterie totals)
            if val_str == 'TOTAL':
                # Check if this is a déchetterie total (not grand total)
                # Grand total is usually after row 100
                is_grand_total = row_idx > 100
                if not is_grand_total:
                    # Total row for a déchetterie - improved styling
                    # Don't modify cell.value, just format
                    for col in range(1, 20):
                        cell = ws.cell(row=row_idx, column=col)
                        # Only format if cell has a value (formula or number)
                        if cell.value is not None and cell.value != '':
                            cell.fill = total_fill
                            cell.font = total_font
                            cell.alignment = total_alignment
                            cell.border = thin_border
                    ws.row_dimensions[row_idx].height = 20
                    continue
            
            # Check if it's a percentage row (PEP, POL, etc.)
            if val_str in ['PEP', 'POL', 'STG', 'SAN', 'YSS', 'BAS', 'MON']:
                # Percentage row
                for col in range(2, 19):
                    cell = ws.cell(row=row_idx, column=col)
                    if cell.value is not None and cell.value != '':
                        cell.number_format = '0.00%'
                        cell.font = data_font
                        cell.alignment = data_alignment
                continue
            
            # Check if it's the grand total row
            if val_str == 'TOTAL' and row_idx > 100:
                # Grand total row - more prominent styling
                for col in range(1, 20):
                    cell = ws.cell(row=row_idx, column=col)
                    if col == 1:
                        cell.fill = grand_total_fill
                        cell.font = grand_total_font
                        cell.alignment = grand_total_alignment
                        cell.border = thick_border
                    elif cell.value is not None and cell.value != '':
                        cell.fill = grand_total_fill
                        cell.font = grand_total_font
                        cell.alignment = grand_total_alignment
                        cell.border = thick_border
                ws.row_dimensions[row_idx].height = 24
                continue
        
        # Set improved column widths for better readability
        ws.column_dimensions['A'].width = 16  # Month names
        for col in range(2, 19):
            ws.column_dimensions[get_column_letter(col)].width = 11  # Category columns
        ws.column_dimensions['S'].width = 13  # TOTAL column
        ws.column_dimensions['T'].width = 15  # sans massicot
        ws.column_dimensions['U'].width = 3   # Spacing
        ws.column_dimensions['V'].width = 13  # DECHETS ULTIMES
        ws.column_dimensions['W'].width = 3  # Spacing
    
    wb.save(output_file)
    wb.close()


if __name__ == "__main__":
    import sys
    
    print("="*70)
    print(" " * 15 + "SYNTHESE DUMP DECHETTERIES")
    print("="*70)
    print("\nCe script synthétise le fichier dump en un fichier Excel formaté.\n")
    
    # Aide si demandée
    if len(sys.argv) > 1 and sys.argv[1] in ['--help', '-h', '--aide', '/?']:
        print("UTILISATION:")
        print("  python synthesize_dump.py [année]")
        print("\n  Exemple:")
        print("  python synthesize_dump.py 2025")
        print("\nCE QUE FAIT LE SCRIPT:")
        print("  - Lit les données depuis la base de données dump (même source que le backend)")
        print("  - Génère un fichier Excel synthétisé dans le dossier 'output'")
        print("  - Contient les données agrégées par déchetterie et par mois")
        print("  - Inclut des formules Excel pour les totaux et statistiques")
        print("  - Les calculs sont identiques à ceux du frontend/backend")
        print("\nPREREQUIS:")
        print("  - Le fichier dump doit avoir été importé dans la base de données")
        print("  - Utilisez l'interface web pour importer le fichier dump si nécessaire")
        print("="*70)
        sys.exit(0)
    
    # Get year from argument or default to 2025
    year = 2025
    if len(sys.argv) > 1:
        try:
            year = int(sys.argv[1])
        except ValueError:
            print(f"\n⚠️  Année invalide : {sys.argv[1]}. Utilisation de l'année par défaut : 2025")
            year = 2025
    
    project_root, input_dir, output_dir = _get_project_paths()
    
    # Créer les dossiers si nécessaire
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    
    # Output file
    output_file = os.path.join(output_dir, f"COLLECTES DECHETTERIES DUMP {year}.xlsx")
    
    try:
        result = synthesize_dump(output_file, year)
        
        if result is not None:
            print(f"\n{'='*70}")
            print(" " * 25 + "SUCCES !")
            print(f"{'='*70}")
            print(f"\nLe fichier a été créé avec succès :")
            print(f"  {output_file}")
            print(f"\nLe fichier contient les données synthétisées par déchetterie et par mois.")
            print(f"{'='*70}\n")
        else:
            print(f"\n{'='*70}")
            print(" " * 25 + "ERREUR")
            print(f"{'='*70}")
            print(f"\nLa synthèse a échoué.")
            print(f"Vérifiez les messages d'erreur ci-dessus.")
            print(f"{'='*70}\n")
            sys.exit(1)
            
    except FileNotFoundError as e:
        print(f"\n{'='*70}")
        print("ERREUR : Fichier introuvable")
        print(f"{'='*70}")
        print(f"\n{str(e)}")
        print(f"\nVérifiez que tous les fichiers nécessaires sont dans le bon dossier.")
        print(f"{'='*70}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n{'='*70}")
        print("ERREUR : Une erreur inattendue s'est produite")
        print(f"{'='*70}")
        print(f"\nType d'erreur : {type(e).__name__}")
        print(f"Message : {str(e)}")
        import traceback
        print(f"\nTraceback :")
        traceback.print_exc()
        print(f"\nSi le problème persiste, contactez le support technique.")
        print(f"{'='*70}\n")
        sys.exit(1)
