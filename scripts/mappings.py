"""
Centralized mappings and utility functions for déchetteries data processing.

This module contains all location and category mappings used throughout the project,
replacing the legacy transform_collectes.py functionality.
"""

# Standard déchetterie locations
STANDARD_DECHETTERIES = ['Pépinière', 'Sanssac', 'St Germain', 'Polignac', 'Yssingeaux', 'Bas-en-Basset', 'Monistrol']

# Mapping from raw location names to standard déchetterie names
DECHETTERIE_MAPPING = {
    # Pépinière variants
    'Pepiniere': 'Pépinière',
    'pepiniere': 'Pépinière',
    'Pépinière': 'Pépinière',
    'pépinière': 'Pépinière',
    'PEPINIERE': 'Pépinière',
    'PÉPINIÈRE': 'Pépinière',
    'Dech. La Pépiniere': 'Pépinière',
    'Dech. La Pepiniere': 'Pépinière',
    'Dech. la pépinière': 'Pépinière',
    'Dech. la Pépinière': 'Pépinière',
    'La Pépinière': 'Pépinière',
    'La Pepiniere': 'Pépinière',
    
    # Sanssac variants
    'Sanssac': 'Sanssac',
    'sanssac': 'Sanssac',
    'SANSSAC': 'Sanssac',
    'Sansac': 'Sanssac',
    'sansac': 'Sanssac',
    'Dech. Sanssac': 'Sanssac',
    'dech. sanssac': 'Sanssac',
    
    # St Germain variants
    'St Germain': 'St Germain',
    'St-Germain': 'St Germain',
    'St. Germain': 'St Germain',
    'st germain': 'St Germain',
    'ST GERMAIN': 'St Germain',
    'Saint Germain': 'St Germain',
    'Saint-Germain': 'St Germain',
    'saint germain': 'St Germain',
    'st-germain': 'St Germain',
    'St-germain': 'St Germain',
    'Dech. Saint-Germain': 'St Germain',
    'Dech. Saint Germain': 'St Germain',
    'dech. saint germain': 'St Germain',
    'Dech. Saint-germain': 'St Germain',
    
    # Polignac variants
    'Polignac': 'Polignac',
    'polignac': 'Polignac',
    'POLIGNAC': 'Polignac',
    'Dech. Polignac': 'Polignac',
    'dech. polignac': 'Polignac',
    
    # Yssingeaux variants
    'Yssingeaux': 'Yssingeaux',
    'yssingeaux': 'Yssingeaux',
    'YSSINGEAUX': 'Yssingeaux',
    'Dech. Yssingeaux': 'Yssingeaux',
    'dech. yssingeaux': 'Yssingeaux',
    
    # Bas-en-Basset variants
    'Bas-en-Basset': 'Bas-en-Basset',
    'Bas-en-basset': 'Bas-en-Basset',
    'bas-en-basset': 'Bas-en-Basset',
    'BAS-EN-BASSET': 'Bas-en-Basset',
    'Dech. Bas-en-basset': 'Bas-en-Basset',
    'Dech. Bas-en-Basset': 'Bas-en-Basset',
    'dech. bas-en-basset': 'Bas-en-Basset',
    
    # Monistrol variants
    'Monistrol': 'Monistrol',
    'monistrol': 'Monistrol',
    'MONISTROL': 'Monistrol',
    'Dech. Monistrol': 'Monistrol',
    'dech. monistrol': 'Monistrol',
}

# Standard category columns (updated to match actual data)
# Standard categories for regular collection
CATEGORY_COLUMNS = [
    'MEUBLES', 'ELECTRO', 'CHINE',
    'VAISSELLE', 'JOUETS', 'PAPETERIE', 'LIVRES',
    'CADRES', 'ASL', 'PUERICULTURE', 'ABJ', 'CD/DVD/K7', 
    'MERCERIE', 'TEXTILE', 'LABEL'
]

# Final fluxes (special treatments - separate from regular categories)
# Note: ENCOMBRANT, EVACUATION, and METAUX are included in DECHETS ULTIMES totals
FINAL_FLUXES = [
    'MASSICOT',        # Orientation de LIVRES
    'DEMANTELEMENT',   # Orientation de 4.PAM
    'DECHETS ULTIMES'  # Includes ENCOMBRANT + EVACUATION + METAUX
]

# Categories that contribute to DECHETS ULTIMES
DECHETS_ULTIMES_SOURCES = ['ENCOMBRANT', 'EVACUATION', 'METAUX']


def map_dechetterie(lieu_collecte):
    """
    Map a raw location name to a standard déchetterie name.
    
    Args:
        lieu_collecte: Raw location name from data
        
    Returns:
        Standardized déchetterie name or 'Pépinière' if not recognized
    """
    import pandas as pd
    
    if pd.isna(lieu_collecte) or str(lieu_collecte).strip() == '':
        return 'Pépinière'
    
    lieu_str = str(lieu_collecte).strip()
    
    # Check for APPORT VOLONTAIRE or APPORT SUR SITE
    if lieu_str.upper() in ['APPORT VOLONTAIRE', 'APPORT SUR SITE']:
        return 'Pépinière'
    
    # Check for NaN values (string representation)
    if lieu_str.upper() in ['NAN', '']:
        return 'Pépinière'
    
    # Check direct mapping first (exact match)
    mapped = DECHETTERIE_MAPPING.get(lieu_str)
    if mapped:
        return mapped
    
    # Try case-insensitive matching if exact match fails
    lieu_upper = lieu_str.upper()
    for key, value in DECHETTERIE_MAPPING.items():
        if key.upper() == lieu_upper:
            return value
    
    # Return Pépinière as default fallback for unmapped locations
    return 'Pépinière'


def map_category_to_collectes(categorie, sous_categorie, flux, orientation=None):
    """
    Map raw category data to COLLECTES format category.
    
    This function determines which category column a data row should be assigned to,
    based on the combination of categorie, sous_categorie, and flux.
    
    The raw data uses a format like "4.CATEGORY_NAME" which needs to be parsed.
    
    Args:
        categorie: Main category from raw data (e.g., "4.BRICOLAGE ( EMMA'TEK)")
        sous_categorie: Subcategory from raw data
        flux: Flux/flow type from raw data (can be a direct category name)
        orientation: Optional orientation/direction
        
    Returns:
        Category name (str) for COLLECTES format or 'AUTRES' if unmapped
    """
    if not categorie:
        return 'AUTRES'
    
    cat_str = str(categorie).strip()
    flux_str = str(flux).strip().upper() if flux else ''
    sous_cat_str = str(sous_categorie).strip().upper() if sous_categorie else ''
    orientation_str = str(orientation).strip().upper() if orientation else ''
    
    # Extract the main category name after the number prefix (e.g., "4.CATEGORY_NAME" -> "CATEGORY_NAME")
    # Also handle formats with spaces like "4 .CATEGORY_NAME"
    import re
    match = re.search(r'^\d+\.?\s*([^(]+)', cat_str)
    extracted_cat = match.group(1).strip().upper() if match else cat_str.upper()
    
    # Remove parenthetical content for cleaner matching
    extracted_cat = re.sub(r'\([^)]*\)', '', extracted_cat).strip()
    
    # Check for MASSICOT and DEMANTELEMENT orientations first
    if orientation_str == 'DEMANTELLEMENT':
        return 'DEMANTELEMENT'
    if orientation_str.upper() in ['MASICOT', 'MASSICOT']:  # Handle both spellings
        return 'MASSICOT'
    
    # Check for DECHETS ULTIMES (highest priority)
    if orientation_str == 'DECHETS ULTIMES' or flux_str == 'DECHETS ULTIMES':
        return 'DECHETS ULTIMES'
    
    # Handle EVACUATION DECHETS category -> all types map to DECHETS ULTIMES
    if 'EVACUATION' in cat_str.upper():
        # All EVACUATION types (including METAUX, ENCOMBRANT, etc.) go to DECHETS ULTIMES
        return 'DECHETS ULTIMES'
    
    # Direct mapping based on flux type (flux can be a category itself)
    flux_mapping = {
        'JOUETS': 'JOUETS',
        'ABJ': 'ABJ',
        'TLC': 'TEXTILE',  # Textile, Linge, Chaussures
        'DEEE': 'ELECTRO',  # Déchets d'Équipements Électriques
    }
    
    if flux_str in flux_mapping:
        return flux_mapping[flux_str]
    
    # Mapping based on extracted category name
    category_mappings = {
        'MEUBLES': 'MEUBLES',
        'ELECTRO': 'ELECTRO',
        'PAM': 'ELECTRO',  # Pièces d'Appareils Ménagers -> ELECTRO
        'CHINE': 'CHINE',
        'VAISSELLE': 'VAISSELLE',
        'JOUETS': 'JOUETS',
        'JEUX/JOUETS': 'JOUETS',
        'JEUX': 'JOUETS',
        'PAPETERIE': 'PAPETERIE',
        'LIVRES': 'LIVRES',
        'CADRES': 'CADRES',
        'ASL': 'ASL',
        'SPORTS': 'ASL',
        'SPORTS-LOISIRS': 'ASL',
        'PUERICULTURE': 'PUERICULTURE',
        'CD/DVD': 'CD/DVD/K7',
        'CD': 'CD/DVD/K7',
        'MERCERIE': 'MERCERIE',
        'TEXTILE': 'TEXTILE',
        'TEXTILES': 'TEXTILE',
        'CHAUSSURES': 'TEXTILE',  # Chaussures -> TEXTILE (flux TLC)
        'SACS': 'TEXTILE',  # Sacs -> TEXTILE (flux TLC)
        'BRICOLAGE': 'ABJ',  # BRICOLAGE -> ABJ
        'LABEL': 'LABEL',  # Label/Boutique
        # ENCOMBRANT and EVACUATION now map to DECHETS ULTIMES
        'ENCOMBRANT': 'DECHETS ULTIMES',
        'EVACUATION': 'DECHETS ULTIMES',
        'METAUX': 'DECHETS ULTIMES',
    }
    
    # Try direct mapping first
    if extracted_cat in category_mappings:
        return category_mappings[extracted_cat]
    
    # Try case-insensitive substring matching
    for key, value in category_mappings.items():
        if key.upper() in extracted_cat or extracted_cat in key.upper():
            return value
    
    # Default to AUTRES if no mapping found
    return 'AUTRES'


def get_dechetteries_list():
    """Get the list of standard déchetteries in the correct order."""
    return STANDARD_DECHETTERIES.copy()


def get_category_columns():
    """Get the list of standard category columns."""
    return CATEGORY_COLUMNS.copy()
