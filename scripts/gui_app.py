"""
Interface graphique pour l'outil de transformation des déchetteries
Permet aux utilisateurs non-techniques d'utiliser l'application sans ligne de commande
"""

import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import os
import sys
import threading
from pathlib import Path

# Import the transformation function
try:
    from transform_collectes import transform_to_collectes
except ImportError:
    # If running as standalone, try relative import
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "transform_to_collectes",
        os.path.join(os.path.dirname(__file__), "transform_collectes.py")
    )
    transform_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(transform_module)
    transform_to_collectes = transform_module.transform_to_collectes


class DechetteriesApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Outil de Transformation Déchetteries")
        self.root.geometry("700x550")
        self.root.minsize(650, 500)
        
        # Style moderne avec ttk
        style = ttk.Style()
        style.theme_use('clam')
        
        # Variables
        self.input_file = tk.StringVar()
        self.output_file = tk.StringVar()
        self.progress_var = tk.StringVar(value="Prêt - Sélectionnez un fichier d'entrée")
        self.is_processing = False
        
        # Couleurs
        self.color_primary = "#2196F3"  # Bleu
        self.color_success = "#4CAF50"  # Vert
        self.color_error = "#F44336"    # Rouge
        
        self.create_widgets()
        
        # Auto-détecter le fichier input au démarrage
        self.auto_detect_input()
        
    def create_widgets(self):
        # Container principal avec padding
        main_frame = ttk.Frame(self.root, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Titre
        title_frame = ttk.Frame(main_frame)
        title_frame.pack(fill=tk.X, pady=(0, 30))
        
        title = tk.Label(
            title_frame,
            text="Transformation des Données Déchetteries",
            font=("Arial", 18, "bold"),
            fg="#333333"
        )
        title.pack()
        
        subtitle = tk.Label(
            title_frame,
            text="Transformez vos données Excel en format COLLECTES",
            font=("Arial", 10),
            fg="#666666"
        )
        subtitle.pack(pady=(5, 0))
        
        # Section fichier d'entrée
        input_frame = ttk.LabelFrame(main_frame, text="Fichier d'entrée", padding="15")
        input_frame.pack(fill=tk.X, pady=(0, 15))
        
        # Label explicatif
        input_label = ttk.Label(
            input_frame,
            text="Sélectionnez le fichier Excel contenant les données à transformer :",
            font=("Arial", 9)
        )
        input_label.pack(anchor=tk.W, pady=(0, 10))
        
        # Champ de saisie et bouton parcourir
        input_path_frame = ttk.Frame(input_frame)
        input_path_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.input_entry = ttk.Entry(
            input_path_frame,
            textvariable=self.input_file,
            font=("Arial", 9),
            state="readonly"
        )
        self.input_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
        
        browse_input_btn = ttk.Button(
            input_path_frame,
            text="Parcourir...",
            command=self.select_input_file,
            width=15
        )
        browse_input_btn.pack(side=tk.LEFT)
        
        # Bouton auto-détection
        auto_detect_btn = tk.Button(
            input_frame,
            text="📁 Utiliser le fichier du dossier 'input'",
            command=self.auto_detect_input,
            bg=self.color_success,
            fg="white",
            font=("Arial", 9, "bold"),
            cursor="hand2",
            relief=tk.FLAT,
            padx=10,
            pady=5
        )
        auto_detect_btn.pack(pady=(5, 0))
        
        # Section fichier de sortie
        output_frame = ttk.LabelFrame(main_frame, text="Fichier de sortie", padding="15")
        output_frame.pack(fill=tk.X, pady=(0, 15))
        
        # Label explicatif
        output_label = ttk.Label(
            output_frame,
            text="Le fichier sera créé dans le dossier 'output' (vous pouvez changer l'emplacement) :",
            font=("Arial", 9)
        )
        output_label.pack(anchor=tk.W, pady=(0, 10))
        
        # Champ de saisie et bouton parcourir
        output_path_frame = ttk.Frame(output_frame)
        output_path_frame.pack(fill=tk.X)
        
        self.output_entry = ttk.Entry(
            output_path_frame,
            textvariable=self.output_file,
            font=("Arial", 9),
            state="readonly"
        )
        self.output_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
        
        browse_output_btn = ttk.Button(
            output_path_frame,
            text="Parcourir...",
            command=self.select_output_file,
            width=15
        )
        browse_output_btn.pack(side=tk.LEFT)
        
        # Zone de statut
        status_frame = ttk.LabelFrame(main_frame, text="Statut", padding="15")
        status_frame.pack(fill=tk.X, pady=(0, 20))
        
        self.progress_label = tk.Label(
            status_frame,
            textvariable=self.progress_var,
            font=("Arial", 10),
            fg="#333333",
            anchor=tk.W
        )
        self.progress_label.pack(fill=tk.X, pady=(0, 10))
        
        self.progress_bar = ttk.Progressbar(
            status_frame,
            mode='indeterminate',
            length=400
        )
        self.progress_bar.pack(fill=tk.X)
        
        # Bouton principal de transformation
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X, pady=(10, 10))
        
        # Séparateur visuel
        separator = ttk.Separator(button_frame, orient='horizontal')
        separator.pack(fill=tk.X, pady=(0, 15))
        
        self.transform_btn = tk.Button(
            button_frame,
            text="🚀 LANCER LA TRANSFORMATION",
            command=self.start_transformation,
            bg=self.color_primary,
            fg="white",
            font=("Arial", 14, "bold"),
            cursor="hand2",
            relief=tk.RAISED,
            bd=3,
            padx=30,
            pady=15,
            state=tk.NORMAL,
            activebackground="#1976D2",
            activeforeground="white"
        )
        self.transform_btn.pack(fill=tk.X)
        
        # Bouton ouvrir dossier de sortie
        self.open_folder_btn = ttk.Button(
            button_frame,
            text="📂 Ouvrir le dossier de sortie",
            command=self.open_output_folder,
            state=tk.DISABLED
        )
        self.open_folder_btn.pack(fill=tk.X, pady=(5, 0))
        
    def select_input_file(self):
        """Ouvre un dialogue pour sélectionner le fichier d'entrée"""
        filename = filedialog.askopenfilename(
            title="Sélectionner le fichier Excel d'entrée",
            filetypes=[
                ("Fichiers Excel", "*.xlsx *.xls"),
                ("Fichiers Excel 2007+", "*.xlsx"),
                ("Fichiers Excel 97-2003", "*.xls"),
                ("Tous les fichiers", "*.*")
            ]
        )
        if filename:
            self.input_file.set(filename)
            self.progress_var.set(f"Fichier sélectionné : {os.path.basename(filename)}")
            self.update_output_default()
    
    def auto_detect_input(self):
        """Détecte automatiquement le premier fichier Excel dans le dossier input"""
        # Gérer le cas où l'app est compilée en .exe
        if getattr(sys, 'frozen', False):
            # L'application est compilée (PyInstaller)
            application_path = os.path.dirname(sys.executable)
            # Chercher le dossier input à côté de l'exécutable
            input_dir = os.path.join(application_path, 'input')
            # Si pas trouvé, chercher dans le dossier parent
            if not os.path.exists(input_dir):
                input_dir = os.path.join(os.path.dirname(application_path), 'input')
        else:
            # Mode développement
            script_dir = os.path.dirname(os.path.abspath(__file__))
            project_root = os.path.dirname(script_dir)
            input_dir = os.path.join(project_root, 'input')
        
        if not os.path.exists(input_dir):
            os.makedirs(input_dir, exist_ok=True)
            self.progress_var.set("Dossier 'input' créé - Veuillez y placer un fichier Excel")
            return
        
        excel_files = [
            f for f in os.listdir(input_dir)
            if os.path.isfile(os.path.join(input_dir, f))
            and f.lower().endswith(('.xlsx', '.xls'))
        ]
        
        if excel_files:
            input_path = os.path.join(input_dir, excel_files[0])
            self.input_file.set(input_path)
            self.progress_var.set(f"Fichier trouvé automatiquement : {excel_files[0]}")
            self.update_output_default()
        else:
            self.progress_var.set("Aucun fichier Excel trouvé dans le dossier 'input'")
            messagebox.showinfo(
                "Aucun fichier trouvé",
                "Aucun fichier Excel trouvé dans le dossier 'input'.\n\n"
                "Veuillez placer un fichier Excel (.xlsx ou .xls) dans le dossier 'input' "
                "ou utilisez le bouton 'Parcourir...' pour sélectionner un fichier."
            )
    
    def update_output_default(self):
        """Met à jour le fichier de sortie par défaut si non spécifié"""
        if not self.output_file.get():
            # Gérer le cas où l'app est compilée en .exe
            if getattr(sys, 'frozen', False):
                # L'application est compilée (PyInstaller)
                application_path = os.path.dirname(sys.executable)
                # Chercher le dossier output à côté de l'exécutable
                output_dir = os.path.join(application_path, 'output')
                # Si pas trouvé, chercher dans le dossier parent
                if not os.path.exists(output_dir):
                    output_dir = os.path.join(os.path.dirname(application_path), 'output')
            else:
                # Mode développement
                script_dir = os.path.dirname(os.path.abspath(__file__))
                project_root = os.path.dirname(script_dir)
                output_dir = os.path.join(project_root, 'output')
            
            os.makedirs(output_dir, exist_ok=True)
            default_output = os.path.join(
                output_dir,
                "COLLECTES DECHETERIES T2 2025.xlsx"
            )
            self.output_file.set(default_output)
    
    def select_output_file(self):
        """Ouvre un dialogue pour sélectionner l'emplacement du fichier de sortie"""
        # Gérer le cas où l'app est compilée en .exe
        if getattr(sys, 'frozen', False):
            # L'application est compilée (PyInstaller)
            application_path = os.path.dirname(sys.executable)
            output_dir = os.path.join(application_path, 'output')
            if not os.path.exists(output_dir):
                output_dir = os.path.join(os.path.dirname(application_path), 'output')
        else:
            # Mode développement
            script_dir = os.path.dirname(os.path.abspath(__file__))
            project_root = os.path.dirname(script_dir)
            output_dir = os.path.join(project_root, 'output')
        os.makedirs(output_dir, exist_ok=True)
        
        filename = filedialog.asksaveasfilename(
            title="Enregistrer le fichier de sortie",
            initialdir=output_dir,
            defaultextension=".xlsx",
            filetypes=[
                ("Fichiers Excel", "*.xlsx"),
                ("Tous les fichiers", "*.*")
            ]
        )
        if filename:
            self.output_file.set(filename)
    
    def start_transformation(self):
        """Démarre la transformation dans un thread séparé"""
        if self.is_processing:
            return
        
        if not self.input_file.get():
            messagebox.showerror(
                "Erreur",
                "Veuillez sélectionner un fichier d'entrée.\n\n"
                "Utilisez le bouton 'Parcourir...' ou 'Utiliser le fichier du dossier input'."
            )
            return
        
        if not os.path.exists(self.input_file.get()):
            messagebox.showerror(
                "Erreur",
                f"Le fichier d'entrée n'existe pas :\n{self.input_file.get()}\n\n"
                "Veuillez sélectionner un fichier valide."
            )
            return
        
        # Définir le fichier de sortie par défaut si non spécifié
        self.update_output_default()
        
        # Désactiver les contrôles et démarrer la progression
        self.is_processing = True
        self.transform_btn.config(state=tk.DISABLED, text="Transformation en cours...")
        self.open_folder_btn.config(state=tk.DISABLED)
        self.progress_bar.start(10)
        self.progress_var.set("Transformation en cours... Veuillez patienter...")
        
        # Lancer la transformation dans un thread séparé
        thread = threading.Thread(target=self.run_transformation, daemon=True)
        thread.start()
    
    def run_transformation(self):
        """Exécute la transformation (appelé depuis un thread)"""
        try:
            result = transform_to_collectes(
                self.input_file.get(),
                self.output_file.get(),
                dechetterie_filter=None,
                combine_all=True
            )
            
            self.root.after(0, self.transformation_complete, result is not None)
        except Exception as e:
            error_msg = str(e)
            self.root.after(0, self.transformation_error, error_msg)
    
    def transformation_complete(self, success):
        """Appelé quand la transformation est terminée"""
        self.progress_bar.stop()
        self.is_processing = False
        self.transform_btn.config(
            state=tk.NORMAL,
            text="🚀 Lancer la Transformation"
        )
        self.open_folder_btn.config(state=tk.NORMAL)
        
        if success:
            self.progress_var.set("✓ Transformation terminée avec succès !")
            self.progress_label.config(fg=self.color_success)
            
            messagebox.showinfo(
                "Succès",
                f"Le fichier a été créé avec succès !\n\n"
                f"Fichier : {os.path.basename(self.output_file.get())}\n"
                f"Emplacement : {os.path.dirname(self.output_file.get())}\n\n"
                f"Vous pouvez maintenant ouvrir ce fichier dans Excel."
            )
        else:
            self.progress_var.set("✗ Erreur lors de la transformation")
            self.progress_label.config(fg=self.color_error)
            messagebox.showerror(
                "Erreur",
                "La transformation a échoué.\n\n"
                "Vérifiez que le fichier d'entrée contient toutes les colonnes requises "
                "(Catégorie, Sous Catégorie, Flux, Poids, Date, Lieu collecte)."
            )
    
    def transformation_error(self, error_msg):
        """Appelé en cas d'erreur pendant la transformation"""
        self.progress_bar.stop()
        self.is_processing = False
        self.transform_btn.config(
            state=tk.NORMAL,
            text="🚀 Lancer la Transformation"
        )
        self.progress_var.set("✗ Erreur lors de la transformation")
        self.progress_label.config(fg=self.color_error)
        
        messagebox.showerror(
            "Erreur",
            f"Une erreur s'est produite lors de la transformation :\n\n{error_msg}\n\n"
            "Vérifiez que le fichier d'entrée est valide et n'est pas ouvert dans Excel."
        )
    
    def open_output_folder(self):
        """Ouvre le dossier de sortie dans l'explorateur de fichiers"""
        output_path = self.output_file.get()
        if output_path and os.path.exists(output_path):
            folder = os.path.dirname(output_path)
            try:
                if sys.platform == "win32":
                    os.startfile(folder)
                elif sys.platform == "darwin":
                    os.system(f'open "{folder}"')
                else:
                    os.system(f'xdg-open "{folder}"')
            except Exception as e:
                messagebox.showerror(
                    "Erreur",
                    f"Impossible d'ouvrir le dossier :\n{str(e)}"
                )
        else:
            # Gérer le cas où l'app est compilée en .exe
            if getattr(sys, 'frozen', False):
                application_path = os.path.dirname(sys.executable)
                output_dir = os.path.join(application_path, 'output')
                if not os.path.exists(output_dir):
                    output_dir = os.path.join(os.path.dirname(application_path), 'output')
            else:
                script_dir = os.path.dirname(os.path.abspath(__file__))
                project_root = os.path.dirname(script_dir)
                output_dir = os.path.join(project_root, 'output')
            if os.path.exists(output_dir):
                try:
                    if sys.platform == "win32":
                        os.startfile(output_dir)
                    elif sys.platform == "darwin":
                        os.system(f'open "{output_dir}"')
                    else:
                        os.system(f'xdg-open "{output_dir}"')
                except Exception as e:
                    messagebox.showerror(
                        "Erreur",
                        f"Impossible d'ouvrir le dossier :\n{str(e)}"
                    )


def main():
    """Point d'entrée principal de l'application"""
    root = tk.Tk()
    app = DechetteriesApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
