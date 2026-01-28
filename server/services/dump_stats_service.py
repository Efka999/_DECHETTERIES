"""
Service de statistiques pour la base de données dump.
"""

from datetime import datetime, timedelta
from pathlib import Path
import sys

import pandas as pd

from services.db import get_dump_connection, init_dump_db

current_file = Path(__file__).resolve()
project_root = current_file.parent.parent.parent
scripts_dir = project_root / 'scripts'
if scripts_dir.exists() and str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))
try:
    from transform_collectes import DECHETTERIE_MAPPING
except Exception:
    DECHETTERIE_MAPPING = {}


def _resolve_dechetterie_name(row):
    """Resolve déchetterie name from row data."""
    lieu = str(row.get('lieu_collecte') or '').strip()
    sheet = str(row.get('source_sheet') or '').strip()

    if sheet and 'BYM' in sheet.upper():
        return 'BYM'

    if lieu.upper() == 'APPORT VOLONTAIRE':
        return 'Pépinière'

    mapped = DECHETTERIE_MAPPING.get(lieu)
    if mapped:
        return mapped
    return None


def build_stats_from_dump_db(year=2025):
    """Build statistics from dump database, using the same format as build_stats_from_db."""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Import map_category_to_collectes from scripts (same as stats_service)
        current_file = Path(__file__).resolve()
        project_root = current_file.parent.parent.parent
        scripts_dir = project_root / 'scripts'
        if scripts_dir.exists() and str(scripts_dir) not in sys.path:
            sys.path.insert(0, str(scripts_dir))
        try:
            from transform_collectes import map_category_to_collectes
        except Exception:
            map_category_to_collectes = None
        
        init_dump_db(year)
        with get_dump_connection(year) as conn:
            df = pd.read_sql(
                """
                SELECT date, lieu_collecte, categorie, sous_categorie, flux, orientation, poids, source_sheet
                FROM raw_dump
                """,
                conn
            )
        
        # Total brut depuis la base de données
        total_brut_db = df['poids'].sum() / 1000  # en tonnes
        logger.info(f"[DUMP STATS] Total brut depuis DB: {total_brut_db:.2f} tonnes ({len(df)} lignes)")

        if df.empty:
            return {
                'success': False,
                'stats': None,
                'error': "Aucune donnée brute disponible dans la base dump."
            }

        df['Date'] = pd.to_datetime(df['date'], errors='coerce')
        total_avant_filtre_date = df['poids'].sum() / 1000
        df = df[df['Date'].notna()].copy()
        total_apres_filtre_date = df['poids'].sum() / 1000 if not df.empty else 0
        total_exclu_date = total_avant_filtre_date - total_apres_filtre_date
        logger.info(f"[DUMP STATS] Total exclu par dates invalides: {total_exclu_date:.2f} tonnes")
        if df.empty:
            return {
                'success': False,
                'stats': None,
                'error': "Aucune date valide dans les données brutes."
            }

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
        # Ne plus filtrer par déchetterie - inclure toutes les déchetteries
        # Les déchetteries non standard seront incluses dans les stats
        allowed_dechetteries = set(DECHETTERIE_MAPPING.values())
        bym_mask = df['source_sheet'].astype(str).str.upper().str.contains('BYM', na=False) if 'source_sheet' in df.columns else False
        # Inclure toutes les déchetteries, pas seulement celles dans le mapping
        # (le filtre était trop restrictif et excluait des données valides)
        logger.info(f"[DUMP STATS] Total avant filtre déchetterie: {df['poids'].sum() / 1000:.2f} tonnes")
        logger.info(f"[DUMP STATS] Inclusion de toutes les déchetteries (pas de filtre)")

        df['DateKey'] = df['Date'].dt.strftime('%Y-%m-%d')
        total_avant_filtre_datekey = df['poids'].sum() / 1000
        df = df[df['DateKey'].notna()].copy()
        total_apres_filtre_datekey = df['poids'].sum() / 1000 if not df.empty else 0
        total_exclu_datekey = total_avant_filtre_datekey - total_apres_filtre_datekey
        if total_exclu_datekey > 0:
            logger.info(f"[DUMP STATS] Total exclu par DateKey invalide: {total_exclu_datekey:.2f} tonnes")

        date_start = df['Date'].min()
        date_end = df['Date'].max()
        if pd.isna(date_start) or pd.isna(date_end):
            return {
                'success': False,
                'stats': None,
                'error': "Impossible de déterminer la plage de dates."
            }

        full_range = pd.date_range(date_start, date_end, freq='D')
        date_order = [d.strftime('%Y-%m-%d') for d in full_range]

        # Calculer le total brut avant filtrage pour diagnostic
        total_brut_avant_filtrage = df['poids'].sum() / 1000  # en tonnes
        
        # Catégories standard (grandes catégories de flux)
        # MASSICOT et DEMANTELEMENT sont inclus dans les catégories pour le calcul du TOTAL
        # DECHETS ULTIMES reste un flux final séparé
        category_columns = ['MEUBLES', 'ELECTRO', 'DEMANTELEMENT', 'CHINE',
                            'VAISSELLE', 'JOUETS', 'PAPETERIE', 'LIVRES', 'MASSICOT',
                            'CADRES', 'ASL', 'PUERICULTURE', 'ABJ', 'CD/DVD/K7', 'PMCB',
                            'MERCERIE', 'TEXTILE', 'AUTRES']  # AUTRES pour les données non mappées
        # Note: DECHETS ULTIMES est un flux final traité séparément (pas inclus dans TOTAL)
        # MASSICOT et DEMANTELEMENT sont maintenant inclus dans category_columns pour correspondre au dump
        final_fluxes = ['DECHETS ULTIMES']

        if map_category_to_collectes is None:
            return {
                'success': False,
                'stats': None,
                'error': "Mapping des catégories indisponible."
            }

        # Mapper les catégories vers les grandes catégories de flux
        df['MappedCategory'] = df.apply(
            lambda row: map_category_to_collectes(
                row['categorie'],
                row['sous_categorie'],
                row['flux'],
                row['orientation']
            ),
            axis=1
        )
        
        # Identifier les données non mappées (qui iront dans AUTRES)
        non_mappees = df[df['MappedCategory'].isna()].copy()
        if not non_mappees.empty:
            logger.info(f"[DUMP STATS] {len(non_mappees)} lignes non mappées (iront dans AUTRES)")
            # Analyser les combinaisons non mappées
            autres_combinations = non_mappees.groupby(['categorie', 'sous_categorie', 'flux', 'orientation']).agg({
                'poids': ['sum', 'count']
            }).reset_index()
            autres_combinations.columns = ['categorie', 'sous_categorie', 'flux', 'orientation', 'poids_total', 'nb_lignes']
            autres_combinations['poids_tonnes'] = autres_combinations['poids_total'] / 1000
            autres_combinations = autres_combinations.sort_values('poids_tonnes', ascending=False)
            total_autres_tonnes = autres_combinations['poids_tonnes'].sum()
            logger.info(f"[DUMP STATS] Total dans AUTRES: {total_autres_tonnes:.2f} tonnes")
            logger.info(f"[DUMP STATS] Toutes les combinaisons dans AUTRES (par poids):")
            for idx, row in autres_combinations.iterrows():
                logger.info(f"  - {row['categorie']} / {row['sous_categorie']} / {row['flux']} / {row['orientation']}: {row['poids_tonnes']:.2f} tonnes ({row['nb_lignes']} lignes)")
        else:
            logger.info(f"[DUMP STATS] Aucune ligne non mappée - AUTRES sera vide")
        
        # Inclure toutes les données : celles non mappées vont dans "AUTRES"
        df.loc[df['MappedCategory'].isna(), 'MappedCategory'] = 'AUTRES'
        mapped_df = df.copy()  # Toutes les données sont incluses
        
        # Calculer le total après mapping
        total_apres_mapping = mapped_df['poids'].sum() / 1000  # en tonnes
        total_autres = (df[df['MappedCategory'] == 'AUTRES']['poids'].sum() / 1000) if len(df[df['MappedCategory'] == 'AUTRES']) > 0 else 0
        
        # Vérifier le total des déchets ultimes mappés
        total_ultimes_mappes = (mapped_df[mapped_df['MappedCategory'] == 'DECHETS ULTIMES']['poids'].sum() / 1000) if len(mapped_df[mapped_df['MappedCategory'] == 'DECHETS ULTIMES']) > 0 else 0
        logger.info(f"[DUMP STATS] Total déchets ultimes mappés: {total_ultimes_mappes:.2f} tonnes")

        # Déchets ultimes : maintenant mappés directement dans MappedCategory
        # On garde cette détection pour référence, mais ils sont déjà dans mapped_df
        ultimes_mask = (
            df['categorie'].astype(str).str.upper().str.strip().eq('EVACUATION DECHETS')
            & df['orientation'].astype(str).str.upper().str.strip().eq('DECHETS ULTIMES')
        )
        ultimes_df = df[ultimes_mask].copy()
        total_ultimes_brut = ultimes_df['poids'].sum() / 1000 if not ultimes_df.empty else 0
        logger.info(f"[DUMP STATS] Total déchets ultimes (brut, avant mapping): {total_ultimes_brut:.2f} tonnes")
        
        # Log pour diagnostic
        logger.info(f"[DUMP STATS] Total brut avant filtrage: {total_brut_avant_filtrage:.2f} tonnes")
        logger.info(f"[DUMP STATS] Total après mapping catégories (inclut AUTRES): {total_apres_mapping:.2f} tonnes")
        logger.info(f"[DUMP STATS] Total dans catégorie AUTRES (non mappé): {total_autres:.2f} tonnes")
        logger.info(f"[DUMP STATS] Total déchets ultimes: {ultimes_df['poids'].sum() / 1000:.2f} tonnes")

        unique_dechetteries = [str(d) for d in df['Dechetterie'].unique() if pd.notna(d)]
        unique_dechetteries = sorted(set(unique_dechetteries))
        standard_order = ['Pépinière', 'Sanssac', 'St Germain', 'Polignac']
        special_cases = [d for d in unique_dechetteries if d not in standard_order]
        ordered_dechetteries = [d for d in standard_order if d in unique_dechetteries] + sorted(special_cases)

        dechetteries_data = {}

        for dech in ordered_dechetteries:
            dech_df = mapped_df[mapped_df['Dechetterie'] == dech].copy()
            if dech_df.empty and ultimes_df[ultimes_df['Dechetterie'] == dech].empty:
                continue

            # MASSICOT et DEMANTELEMENT sont maintenant dans category_columns, donc inclus dans le pivot normal
            # DECHETS ULTIMES reste un flux final séparé et ne doit PAS être dans le pivot des catégories
            dech_df_categories = dech_df[~dech_df['MappedCategory'].isin(final_fluxes)].copy()
            dech_df_final_fluxes = dech_df[dech_df['MappedCategory'].isin(final_fluxes)].copy()
            
            # Pivot pour toutes les catégories (inclut maintenant MASSICOT et DEMANTELEMENT, mais PAS DECHETS ULTIMES)
            summary = dech_df_categories.groupby(['DateKey', 'MappedCategory'])['poids'].sum().reset_index()
            pivot_df = summary.pivot_table(
                index='DateKey',
                columns='MappedCategory',
                values='poids',
                aggfunc='sum',
                fill_value=0
            ).reset_index()
            
            # S'assurer que DECHETS ULTIMES n'est pas dans le pivot (au cas où il serait mappé comme catégorie)
            if 'DECHETS ULTIMES' in pivot_df.columns:
                pivot_df = pivot_df.drop(columns=['DECHETS ULTIMES'])
            
            # Ajouter les flux finaux séparément (seulement DECHETS ULTIMES maintenant)
            if not dech_df_final_fluxes.empty:
                final_fluxes_summary = dech_df_final_fluxes.groupby(['DateKey', 'MappedCategory'])['poids'].sum().reset_index()
                final_fluxes_pivot = final_fluxes_summary.pivot_table(
                    index='DateKey',
                    columns='MappedCategory',
                    values='poids',
                    aggfunc='sum',
                    fill_value=0
                ).reset_index()
                # Fusionner les flux finaux dans le pivot principal
                for flux in final_fluxes:
                    if flux in final_fluxes_pivot.columns:
                        pivot_df = pivot_df.merge(
                            final_fluxes_pivot[['DateKey', flux]],
                            on='DateKey',
                            how='left'
                        ).fillna(0)
                    else:
                        pivot_df[flux] = 0
            else:
                for flux in final_fluxes:
                    pivot_df[flux] = 0

            ordered_df = pd.DataFrame({'DateKey': date_order})
            result_df = ordered_df.merge(pivot_df, on='DateKey', how='left').fillna(0)

            months_data = {}
            for _, row in result_df.iterrows():
                month_name = row['DateKey']
                # Extraire toutes les catégories (inclut maintenant MASSICOT et DEMANTELEMENT)
                month_data = {col: float(row[col]) if col in row else 0 for col in category_columns}
                # Extraire les flux finaux séparément (seulement DECHETS ULTIMES maintenant)
                for flux in final_fluxes:
                    month_data[flux] = float(row[flux]) if flux in row else 0
                # Le TOTAL est la somme de toutes les catégories + tous les flux finaux
                # Cela correspond au total du dump Excel (somme de toutes les lignes)
                month_total = sum(month_data[col] for col in category_columns) + sum(month_data.get(flux, 0) for flux in final_fluxes)
                month_data['TOTAL'] = month_total
                months_data[month_name] = month_data

            # Totaux par déchetterie
            totals_by_category = {col: 0 for col in category_columns}
            totals_by_final_flux = {flux: 0 for flux in final_fluxes}
            total_sum = 0
            for month_data in months_data.values():
                for col in category_columns:
                    totals_by_category[col] += month_data.get(col, 0)
                for flux in final_fluxes:
                    totals_by_final_flux[flux] += month_data.get(flux, 0)
                total_sum += month_data.get('TOTAL', 0)

            # Le TOTAL inclut déjà toutes les catégories + tous les flux finaux (calculé dans month_data['TOTAL'])
            # Donc total_sum contient déjà tout, pas besoin d'ajouter les flux finaux à nouveau
            totals_by_category['TOTAL'] = total_sum
            # Ajouter les flux finaux au total par déchetterie (pour affichage séparé)
            for flux in final_fluxes:
                totals_by_category[flux] = totals_by_final_flux[flux]

            dechetteries_data[dech] = {
                'months': months_data,
                'total': totals_by_category,
                'categories': {}
            }

        # Totaux globaux
        global_totals = {col: 0 for col in category_columns}
        for flux in final_fluxes:
            global_totals[flux] = 0
        global_totals['TOTAL'] = 0

        for data in dechetteries_data.values():
            for col in category_columns:
                global_totals[col] += data['total'].get(col, 0)
            for flux in final_fluxes:
                global_totals[flux] += data['total'].get(flux, 0)
            # Le TOTAL inclut déjà toutes les catégories + flux finaux (calculé ci-dessus)
            global_totals['TOTAL'] += data['total'].get('TOTAL', 0)

        dataset_year = None
        date_range_label = None
        if date_start is not None and date_end is not None:
            date_range_label = f"DU {date_start.strftime('%d/%m/%Y')} au {date_end.strftime('%d/%m/%Y')}"
            if date_start.year == date_end.year:
                dataset_year = str(date_start.year)
            else:
                dataset_year = f"{date_start.year}-{date_end.year}"

        # Calculer le total final pour diagnostic
        # Le TOTAL inclut maintenant toutes les catégories + tous les flux finaux
        total_categories_only = sum(global_totals[col] / 1000 for col in category_columns if col not in ['MASSICOT', 'DEMANTELEMENT'])  # en tonnes
        total_massicot_demantelement = (global_totals.get('MASSICOT', 0) + global_totals.get('DEMANTELEMENT', 0)) / 1000  # en tonnes
        total_final_fluxes = sum(global_totals[flux] / 1000 for flux in final_fluxes)  # en tonnes (seulement DECHETS ULTIMES)
        total_final_calcule = global_totals['TOTAL'] / 1000  # en tonnes (déjà inclut tout)
        logger.info(f"[DUMP STATS] Total catégories (sans MASSICOT/DEMANTELEMENT): {total_categories_only:.2f} tonnes")
        logger.info(f"[DUMP STATS] Total MASSICOT + DEMANTELEMENT: {total_massicot_demantelement:.2f} tonnes")
        for flux in final_fluxes:
            logger.info(f"[DUMP STATS] Total {flux}: {global_totals[flux] / 1000:.2f} tonnes")
        logger.info(f"[DUMP STATS] Total flux finaux (DECHETS ULTIMES): {total_final_fluxes:.2f} tonnes")
        logger.info(f"[DUMP STATS] Total final (TOTAL, inclut tout): {total_final_calcule:.2f} tonnes")
        logger.info(f"[DUMP STATS] Total brut attendu: {total_brut_avant_filtrage:.2f} tonnes")
        logger.info(f"[DUMP STATS] Différence: {total_brut_avant_filtrage - total_final_calcule:.2f} tonnes")
        
        stats = {
            'dechetteries': dechetteries_data,
            'global_totals': global_totals,
            'category_columns': category_columns,
            'final_fluxes': final_fluxes,
            'months_order': date_order,
            'num_dechetteries': len(dechetteries_data),
            'num_months': len(date_order),
            'dataset_year': dataset_year,
            'date_start': date_start.strftime('%Y-%m-%d') if date_start is not None else None,
            'date_end': date_end.strftime('%Y-%m-%d') if date_end is not None else None,
            'date_range': date_range_label,
            # Informations de diagnostic
            '_diagnostic': {
                'total_brut_tonnes': round(total_brut_avant_filtrage, 2),
                'total_apres_mapping_tonnes': round(total_apres_mapping, 2),
                'total_autres_tonnes': round(total_autres, 2),
                'total_final_calcule_tonnes': round(total_final_calcule, 2),
                'total_dechets_ultimes_tonnes': round(ultimes_df['poids'].sum() / 1000, 2) if not ultimes_df.empty else 0
            }
        }

        return {
            'success': True,
            'stats': stats,
            'error': None
        }
    except Exception as exc:
        import traceback
        return {
            'success': False,
            'stats': None,
            'error': f"Erreur lors du calcul des statistiques: {str(exc)}\n{traceback.format_exc()}"
        }


def get_time_series(granularity='day', year=2025):
    """Get time series data from dump database."""
    init_dump_db(year)
    with get_dump_connection(year) as conn:
        cursor = conn.cursor()

        if granularity == 'week':
            date_expr = "strftime('%Y-W%W', date)"
        elif granularity == 'month':
            date_expr = "substr(date,1,7)"
        else:
            date_expr = "date"

        date_bounds = cursor.execute(
            "SELECT MIN(date) AS start_date, MAX(date) AS end_date FROM raw_dump"
        ).fetchone()
        if not date_bounds or not date_bounds['start_date'] or not date_bounds['end_date']:
            return []

        start_date = datetime.strptime(date_bounds['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(date_bounds['end_date'], '%Y-%m-%d').date()

        if granularity == 'week':
            period_start = start_date - timedelta(days=start_date.weekday())
            periods = []
            cursor_date = period_start
            while cursor_date <= end_date:
                year_val, week, _ = cursor_date.isocalendar()
                periods.append(f"{year_val}-W{week:02d}")
                cursor_date += timedelta(days=7)
        elif granularity == 'month':
            periods = []
            cursor_date = start_date.replace(day=1)
            while cursor_date <= end_date:
                periods.append(cursor_date.strftime('%Y-%m'))
                month = cursor_date.month + 1
                year_val = cursor_date.year + (1 if month == 13 else 0)
                month = 1 if month == 13 else month
                cursor_date = cursor_date.replace(year=year_val, month=month)
        else:
            periods = [
                (start_date + timedelta(days=i)).strftime('%Y-%m-%d')
                for i in range((end_date - start_date).days + 1)
            ]

        # Get unique déchetteries
        dech_rows = cursor.execute(
            """
            SELECT DISTINCT lieu_collecte
            FROM raw_dump
            WHERE lieu_collecte IS NOT NULL
            ORDER BY lieu_collecte ASC
            """
        ).fetchall()
        dechetteries = [row['lieu_collecte'] for row in dech_rows]

        # Map to standard names
        mapped_dechetteries = []
        for dech in dechetteries:
            mapped = DECHETTERIE_MAPPING.get(dech, dech)
            if dech.upper() == 'APPORT VOLONTAIRE':
                mapped = 'Pépinière'
            if mapped not in mapped_dechetteries:
                mapped_dechetteries.append(mapped)

        rows = cursor.execute(
            f"""
            SELECT {date_expr} AS period,
                   lieu_collecte,
                   SUM(poids) AS total
            FROM raw_dump
            GROUP BY period, lieu_collecte
            ORDER BY period ASC, lieu_collecte ASC
            """
        ).fetchall()

    # Map to standard déchetterie names
    by_key = {}
    for row in rows:
        dech = row['lieu_collecte']
        mapped = DECHETTERIE_MAPPING.get(dech, dech)
        if dech.upper() == 'APPORT VOLONTAIRE':
            mapped = 'Pépinière'
        key = (row['period'], mapped)
        by_key[key] = by_key.get(key, 0) + row['total']

    filled = []
    for period in periods:
        for dech in mapped_dechetteries:
            filled.append({
                'period': period,
                'dechetterie': dech,
                'total': by_key.get((period, dech), 0)
            })

    return filled


def get_category_stats(year=2025):
    """Get category statistics from dump database."""
    init_dump_db(year)
    with get_dump_connection(year) as conn:
        cursor = conn.cursor()
        rows = cursor.execute(
            """
            SELECT
              categorie,
              sous_categorie,
              SUM(poids) AS total
            FROM raw_dump
            GROUP BY categorie, sous_categorie
            ORDER BY total DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def get_flux_orientation_matrix(year=2025):
    """Get flux-orientation matrix from dump database."""
    init_dump_db(year)
    with get_dump_connection(year) as conn:
        cursor = conn.cursor()
        rows = cursor.execute(
            """
            SELECT
              flux,
              COALESCE(orientation, 'NON DEFINI') AS orientation,
              SUM(poids) AS total
            FROM raw_dump
            GROUP BY flux, COALESCE(orientation, 'NON DEFINI')
            ORDER BY total DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def get_anomalies(limit=10, year=2025):
    """Get anomalies from dump database."""
    init_dump_db(year)
    with get_dump_connection(year) as conn:
        cursor = conn.cursor()
        rows = cursor.execute(
            """
            SELECT
              date,
              lieu_collecte,
              flux,
              SUM(poids) AS total
            FROM raw_dump
            GROUP BY date, lieu_collecte, flux
            ORDER BY total DESC
            LIMIT ?
            """,
            (limit,)
        ).fetchall()
    return [dict(row) for row in rows]


def get_missing_days(year=2025):
    """Get missing days from dump database."""
    init_dump_db(year)
    with get_dump_connection(year) as conn:
        cursor = conn.cursor()
        date_rows = cursor.execute(
            "SELECT DISTINCT date FROM raw_dump ORDER BY date ASC"
        ).fetchall()
        if not date_rows:
            return []

        dates = [datetime.strptime(row['date'], '%Y-%m-%d').date() for row in date_rows]
        start = dates[0]
        end = dates[-1]
        all_days = set(start + timedelta(days=i) for i in range((end - start).days + 1))

        dech_rows = cursor.execute(
            """
            SELECT DISTINCT lieu_collecte, date
            FROM raw_dump
            WHERE lieu_collecte IS NOT NULL
            """
        ).fetchall()

    # Map to standard déchetterie names
    by_dech = {}
    for row in dech_rows:
        dech = row['lieu_collecte']
        mapped = DECHETTERIE_MAPPING.get(dech, dech)
        if dech.upper() == 'APPORT VOLONTAIRE':
            mapped = 'Pépinière'
        by_dech.setdefault(mapped, set()).add(datetime.strptime(row['date'], '%Y-%m-%d').date())

    results = []
    for dech, dates_set in by_dech.items():
        missing = sorted(all_days - dates_set)
        results.append({
            'dechetterie': dech,
            'missing_days': [d.isoformat() for d in missing]
        })

    return results


def get_comparison(year=2025):
    """Get comparison statistics from dump database."""
    init_dump_db(year)
    with get_dump_connection(year) as conn:
        cursor = conn.cursor()
        rows = cursor.execute(
            """
            SELECT lieu_collecte, SUM(poids) AS total
            FROM raw_dump
            GROUP BY lieu_collecte
            ORDER BY total DESC
            """
        ).fetchall()

    # Map to standard déchetterie names and aggregate
    by_dech = {}
    for row in rows:
        dech = row['lieu_collecte']
        mapped = DECHETTERIE_MAPPING.get(dech, dech)
        if dech.upper() == 'APPORT VOLONTAIRE':
            mapped = 'Pépinière'
        by_dech[mapped] = by_dech.get(mapped, 0) + row['total']

    total_sum = sum(by_dech.values()) if by_dech else 0
    avg = total_sum / len(by_dech) if by_dech else 0

    results = []
    for dech, total in sorted(by_dech.items(), key=lambda x: x[1], reverse=True):
        results.append({
            'dechetterie': dech,
            'total': total,
            'delta_vs_avg': total - avg
        })

    return results
