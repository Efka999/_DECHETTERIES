import pandas as pd
import sys
import os

def read_xlsx_file(filepath):
    """Read an XLSX file and return information about it"""
    try:
        # Read all sheets from the Excel file
        excel_file = pd.ExcelFile(filepath)
        
        print(f"\n{'='*60}")
        print(f"File: {os.path.basename(filepath)}")
        print(f"{'='*60}")
        print(f"Number of sheets: {len(excel_file.sheet_names)}")
        print(f"Sheet names: {excel_file.sheet_names}")
        
        # Read each sheet
        for sheet_name in excel_file.sheet_names:
            print(f"\n{'-'*60}")
            print(f"Sheet: {sheet_name}")
            print(f"{'-'*60}")
            
            df = pd.read_excel(filepath, sheet_name=sheet_name)
            
            print(f"Shape: {df.shape[0]} rows × {df.shape[1]} columns")
            print(f"\nColumn names:")
            for i, col in enumerate(df.columns, 1):
                print(f"  {i}. {col}")
            
            print(f"\nFirst few rows:")
            print(df.head(10).to_string())
            
            print(f"\nData types:")
            print(df.dtypes)
            
            print(f"\nBasic statistics:")
            print(df.describe())
            
        return excel_file
        
    except Exception as e:
        print(f"Error reading {filepath}: {str(e)}")
        return None

if __name__ == "__main__":
    # Files to read
    files = [
        "analyse caté Christophe.xlsx",
        "COLLECTES DECHETERIES 2025.xlsx"
    ]
    
    for filepath in files:
        if os.path.exists(filepath):
            read_xlsx_file(filepath)
        else:
            print(f"File not found: {filepath}")
