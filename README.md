# GDR Dump (Beta)

Outil de transformation des données déchetteries en format de présentation client (format COLLECTES).

## 📁 Structure du Projet

```
_DECHETTERIES/
├── scripts/                    # OUTILS DÉVELOPPEMENT ET UTILITAIRES
│   ├── mappings.py                   # Mappages centralisés (lieu/catégories)
│   ├── synthesize_dump.py            # Génère un fichier Excel synthétisé
│   ├── gui_app.py                    # Interface graphique tkinter (legacy)
│   ├── check_dates.py                # Vérification des dates (dev)
│   ├── read_xlsx.py                  # Inspection de fichiers Excel (dev)
│   ├── compare_calculations.py       # Diagnostic des calculs (dev)
│   ├── compare_with_dump_total.py    # Comparaison totaux (dev)
│   └── build/                        # Fichiers de compilation
│       ├── build_exe.bat             # Script de compilation Windows
│       ├── build_exe.spec            # Configuration PyInstaller
│       └── requirements_build.txt     # Dépendances pour build
│
├── server/                     # API Flask (Backend)
│   ├── app.py                 # Serveur Flask
│   ├── api/                    # Endpoints API
│   ├── services/               # Services (réutilise scripts/)
│   └── requirements.txt        # Dépendances backend
├── vite/                       # Application React (Frontend Vite)
│   ├── src/                    # Code source React
│   ├── package.json            # Dépendances frontend
│   └── scripts/                # Scripts utilitaires
│
├── input/                      # Fichiers Excel d'entrée (partagé)
│   └── [N'importe quel fichier .xlsx ou .xls]
├── output/                     # Fichiers Excel générés (partagé)
│   └── COLLECTES DECHETERIES T2 2025.xlsx
└── README.md                   # Ce fichier
```

## 🚀 Utilisation Simple (Pour Débutants)

### Option 1 : Application Web React (NOUVEAU - Recommandé)

L'application web offre une interface moderne accessible depuis votre navigateur.

#### Prérequis

1. **Python 3** installé
2. **Node.js** installé (pour React) - [Télécharger Node.js](https://nodejs.org/)

#### Démarrage Rapide

1. **Installer les dépendances** (première fois uniquement) :
```bash
# Backend
cd server
pip install -r requirements.txt

# Frontend
cd ../vite
npm install
```

2. **Démarrer l'application** :
```bash
cd vite
npm run dev:full
```

Cela démarre automatiquement :
- Le backend Flask sur `http://localhost:5000`
- Le frontend Vite sur `http://localhost:5173`

Le navigateur s'ouvrira automatiquement sur `http://localhost:5173`

#### Base de données locale (SQLite)

Le backend peut ingérer les fichiers bruts du dossier `input/` dans une base SQLite locale.

- **Import des fichiers bruts** (tous les `.xlsx/.xls` du dossier `input/`) :
```bash
curl -X POST http://localhost:5000/api/db/import -H "Content-Type: application/json" -d "{\"force\": false}"
```
- **Statut de la base** :
```bash
curl http://localhost:5000/api/db/status
```
- **Statistiques basées sur les données brutes** :
```bash
curl http://localhost:5000/api/stats
```

La base SQLite est stockée localement dans `server/data/collectes.db` (non versionnée).

#### Utilisation

1. **Glissez-déposez** votre fichier Excel dans la zone prévue
   - OU cliquez pour sélectionner un fichier
2. Cliquez sur **"🚀 Lancer la Transformation"**
3. Attendez la fin du traitement
4. Le fichier généré se télécharge automatiquement

#### Avantages

- ✅ Interface moderne et intuitive
- ✅ Drag & drop de fichiers
- ✅ Pas de compilation nécessaire
- ✅ Accessible depuis n'importe quel navigateur
- ✅ Mise à jour simple (juste rafraîchir la page)

### Option 2 : Interface Graphique tkinter (Desktop)

Interface graphique desktop avec tkinter (fonctionne sans navigateur).

L'interface graphique permet d'utiliser l'outil sans ligne de commande, simplement en cliquant sur des boutons.

#### Étape 1 : Préparer les fichiers

1. **Placez votre fichier Excel dans le dossier `input`**
   - Le fichier peut avoir **n'importe quel nom** (ex: `mes_donnees.xlsx`, `T2 25 Analyse Catégories.xlsx`, etc.)
   - Le script utilisera automatiquement le **premier fichier Excel** trouvé dans le dossier
   - Le script lira toujours la **première feuille** du fichier Excel
   - Assurez-vous que le fichier n'est **pas ouvert** dans Excel

#### Étape 2 : Installer les outils nécessaires (une seule fois)

Ouvrez un terminal dans le dossier du projet et tapez :

```bash
pip install pandas openpyxl
```

**Note :** Si vous voyez une erreur "pip n'est pas reconnu", essayez `python -m pip install pandas openpyxl`

#### Étape 3 : Lancer l'interface graphique

Ouvrez un terminal dans le dossier du projet et tapez :

```bash
python scripts/gui_app.py
```

Une fenêtre s'ouvrira avec l'interface graphique.

#### Étape 4 : Utiliser l'interface

1. **Sélectionner le fichier d'entrée** :
   - Cliquez sur "📁 Utiliser le fichier du dossier 'input'" pour utiliser automatiquement le fichier dans `input/`
   - OU cliquez sur "Parcourir..." pour sélectionner un fichier manuellement

2. **Vérifier le fichier de sortie** :
   - Le fichier de sortie est défini automatiquement dans `output/COLLECTES DECHETERIES T2 2025.xlsx`
   - Vous pouvez cliquer sur "Parcourir..." pour changer l'emplacement si nécessaire

3. **Lancer la transformation** :
   - Cliquez sur "🚀 Lancer la Transformation"
   - Une barre de progression s'affichera pendant le traitement
   - Attendez le message de succès

4. **Récupérer le résultat** :
   - Cliquez sur "📂 Ouvrir le dossier de sortie" pour ouvrir le dossier contenant le fichier généré
   - Le fichier `COLLECTES DECHETERIES T2 2025.xlsx` est prêt à être utilisé

### Option 2 : Ligne de Commande (Pour utilisateurs avancés)

#### Étape 1 : Préparer les fichiers

1. **Placez votre fichier Excel dans le dossier `input`**
   - Le fichier peut avoir **n'importe quel nom** (ex: `mes_donnees.xlsx`, `T2 25 Analyse Catégories.xlsx`, etc.)
   - Le script utilisera automatiquement le **premier fichier Excel** trouvé dans le dossier
   - Le script lira toujours la **première feuille** du fichier Excel
   - Assurez-vous que le fichier n'est **pas ouvert** dans Excel

2. **Vérifiez que Python est installé**
   - Si vous n'êtes pas sûr, ouvrez un terminal et tapez : `python --version`
   - Si une erreur apparaît, installez Python depuis [python.org](https://www.python.org/)

#### Étape 2 : Installer les outils nécessaires (une seule fois)

Ouvrez un terminal dans le dossier du projet et tapez :

```bash
pip install pandas openpyxl
```

**Note :** Si vous voyez une erreur "pip n'est pas reconnu", essayez `python -m pip install pandas openpyxl`

#### Étape 3 : Lancer le script

Ouvrez un terminal dans le dossier du projet et tapez simplement :

```bash
python scripts/transform_collectes.py
```

C'est tout ! Le script va :
- ✅ Trouver automatiquement le premier fichier Excel dans `input/` (quel que soit son nom)
- ✅ Lire automatiquement la première feuille du fichier Excel
- ✅ Traiter toutes les déchetteries
- ✅ Créer un fichier formaté dans `output/`

#### Étape 4 : Récupérer le résultat

Le fichier généré se trouve dans le dossier `output/` :
- **Nom :** `COLLECTES DECHETERIES T2 2025.xlsx`
- **Contenu :** Toutes les déchetteries sur une seule feuille avec totaux et statistiques

## 📊 Déchetteries Traitées

Le script traite automatiquement **7 déchetteries** :

**Standard (4) :**
1. Pépinière
2. Sanssac
3. St Germain
4. Polignac

**Spéciales (3) :**
5. Yssingeaux
6. Bas-en-basset
7. Monistrol

## 📦 Installation des Dépendances

### Pour l'Application Web (React + Flask)

**Backend :**
```bash
cd server
pip install -r requirements.txt
```

**Frontend :**
```bash
cd vite
npm install
```

**Note :** Assurez-vous d'avoir installé les dépendances avant de démarrer (`pip install -r server/requirements.txt` et `npm install` dans `vite/`).

#### Configuration avec fichier `.env`

Le projet utilise un fichier `.env` dans le dossier `vite/` pour la configuration. Ce fichier est automatiquement ignoré par git.

**Variables disponibles :**
- `USE_HTTPS=true` / `VITE_USE_HTTPS=true` : Active HTTPS pour le backend et le frontend
- `PORT=5000` : Port du serveur backend (défaut: 5000)
- `FLASK_ENV=development` : Mode debug Flask
- `VITE_API_URL=http://localhost:5000` : URL de l'API backend (optionnel, utilise le proxy par défaut)
- `FRONTEND_URL=...` : URL du frontend en production (pour CORS)

**Exemple de `.env` :**
```env
# Activer HTTPS
USE_HTTPS=true
VITE_USE_HTTPS=true

# Port backend
PORT=5000

# Mode debug
FLASK_ENV=development
```

#### Démarrage avec HTTPS (Optionnel)

Pour activer HTTPS en développement local :

**Méthode 1 : Via le fichier `.env`** (recommandé)
1. Éditez `vite/.env` et décommentez les lignes :
   ```env
   USE_HTTPS=true
   VITE_USE_HTTPS=true
   ```
2. **Générer les certificats SSL** (une seule fois) :
   ```bash
   cd server
   python generate_cert.py
   ```
3. **Démarrer normalement** :
   ```bash
   cd vite
   npm run dev:full
   ```

**Méthode 2 : Via la ligne de commande**
```bash
cd vite
npm run dev:full:https
```

Le navigateur vous demandera d'accepter le certificat auto-signé (normal en développement).

### Pour les Outils Existants (CLI et tkinter)

```bash
pip install pandas openpyxl
```

## 💻 Créer un Exécutable (.exe) Autonome

Si vous souhaitez créer un fichier `.exe` que vous pouvez distribuer sans avoir besoin d'installer Python, suivez ces étapes :

### Prérequis

1. **Installer PyInstaller** :
   ```bash
   pip install pyinstaller
   ```

2. **Vérifier que tous les scripts sont présents** :
   - `scripts/gui_app.py` (interface graphique)
   - `scripts/transform_collectes.py` (script principal de transformation)
   - `scripts/build/build_exe.bat` (script de compilation)
   - `scripts/build/build_exe.spec` (configuration PyInstaller)

### Compilation

#### Méthode 1 : Double-clic (LE PLUS SIMPLE - RECOMMANDÉ)

1. Ouvrez l'explorateur Windows
2. Naviguez vers le dossier `scripts/build/`
3. **Double-cliquez sur `COMPILER.bat`** (ou `build_exe.bat`)
4. Suivez les instructions à l'écran

C'est tout ! Le script va tout faire automatiquement.

#### Méthode 2 : Depuis PowerShell

**⚠️ IMPORTANT : Dans PowerShell, vous DEVEZ utiliser `.\` avant le nom du fichier !**

1. Ouvrez PowerShell
2. Naviguez vers le dossier :
   ```powershell
   cd scripts\build
   ```
3. Exécutez le script PowerShell (recommandé) :
   ```powershell
   .\build_exe.ps1
   ```
   
   Si vous obtenez une erreur de politique d'exécution :
   ```powershell
   powershell -ExecutionPolicy Bypass -File build_exe.ps1
   ```
   
   OU utilisez le script batch (notez le `.\` au début) :
   ```powershell
   .\build_exe.bat
   ```
   
   OU via cmd :
   ```powershell
   cmd /c build_exe.bat
   ```

**❌ Erreur courante :**
Si vous tapez `build_exe.bat` sans le `.\`, vous obtiendrez :
```
Le terme «build_exe.bat» n'est pas reconnu
```

**✅ Solution :** Utilisez toujours `.\build_exe.bat` ou `cmd /c build_exe.bat`

#### Méthode 3 : Depuis l'Invite de commandes (cmd.exe)

1. Ouvrez l'Invite de commandes (cmd.exe, pas PowerShell)
2. Naviguez vers le dossier :
   ```cmd
   cd scripts\build
   ```
3. Exécutez le script :
   ```cmd
   build_exe.bat
   ```

Le script va :
- Vérifier que Python et PyInstaller sont installés
- Installer PyInstaller automatiquement si nécessaire
- Compiler l'application en un fichier `.exe` unique
- Créer l'exécutable dans le dossier `dist/`

#### Méthode 2 : Utiliser PyInstaller directement

```bash
cd scripts
pyinstaller build/build_exe.spec
```

### Résultat

Après la compilation, vous trouverez :
- **Fichier exécutable** : `dist/TransformationDechetteries.exe`
- **Taille** : Environ 50-100 MB (contient Python et toutes les dépendances)

### Distribution

Vous pouvez maintenant distribuer le fichier `TransformationDechetteries.exe` :
- ✅ **Aucune installation de Python requise** pour les utilisateurs finaux
- ✅ **Double-clic pour lancer** l'application
- ✅ **Interface graphique** incluse
- ⚠️ **Taille importante** : Le fichier est volumineux car il contient Python et toutes les bibliothèques

### Notes importantes

- L'exécutable est spécifique à Windows (pour créer un .exe)
- Pour Mac/Linux, utilisez les options PyInstaller appropriées
- La première exécution peut être plus lente (extraction des fichiers temporaires)
- L'antivirus peut parfois signaler un faux positif (normal pour les exécutables PyInstaller)

## 📝 Options Avancées

### Personnaliser le nom du fichier de sortie (ligne de commande)

```bash
python scripts/transform_collectes.py mon_fichier.xlsx
```

Le fichier sera créé dans le dossier `output/` avec le nom que vous avez choisi.

### Obtenir de l'aide (ligne de commande)

```bash
python scripts/transform_collectes.py --help
```

## ⚠️ Résolution de Problèmes

### Erreur : "Aucun fichier Excel trouvé dans le dossier 'input'"

**Solutions :**
1. Vérifiez qu'il y a bien un fichier Excel (`.xlsx` ou `.xls`) dans le dossier `input/`
2. Le fichier peut avoir **n'importe quel nom** - le script le trouvera automatiquement
3. Vérifiez que le fichier a bien l'extension `.xlsx` ou `.xls`
4. Fermez le fichier s'il est ouvert dans Excel

### Erreur : "Module not found" ou "No module named 'pandas'"

**Solution :**
Installez les outils nécessaires :
```bash
pip install pandas openpyxl
```

### Erreur : "python n'est pas reconnu"

**Solutions :**
1. Vérifiez que Python est installé : `python --version`
2. Essayez `py` au lieu de `python` : `py scripts/transform_collectes.py`
3. Sur Mac/Linux, essayez `python3` : `python3 scripts/transform_collectes.py`

### Le fichier de sortie est vide ou incorrect

**Vérifications :**
1. Le fichier d'entrée contient-il des données ?
2. Y a-t-il des messages d'erreur dans le terminal ?
3. Les dates dans le fichier d'entrée sont-elles valides ?

## 📋 Format du Fichier de Sortie

Le fichier généré correspond **exactement** au format `COLLECTES DECHETERIES 2025.xlsx` :

- **Ligne 1** : Titre avec la plage de dates (détectée automatiquement)
- **Ligne 2** : Note "sans massicot et démantèlement"
- **Ligne 3** : En-têtes des colonnes (nom de la déchetterie + catégories)
- **Lignes suivantes** : Données mensuelles (JANVIER, FEVRIER, MARS, etc.)

**Formatage automatique :**
- ✅ Couleurs : En-têtes en bleu-gris, données en jaune
- ✅ Bordures : Bordures moyennes autour de toutes les cellules
- ✅ Alignement : Texte centré
- ✅ Formules : Totaux calculés automatiquement
- ✅ Statistiques : Pourcentages et totaux généraux en bas

**Structure :**
- Chaque déchetterie a sa propre section
- Une ligne "Total" après chaque section
- Des statistiques en bas (totaux généraux, pourcentages)

## 🔧 Fonctionnalités Automatiques

- ✅ **Détection automatique du fichier** : Le script trouve automatiquement le premier fichier Excel dans `input/` (quel que soit son nom)
- ✅ **Lecture automatique de la première feuille** : Le script lit toujours la première feuille du fichier Excel
- ✅ **Détection automatique des dates** : Le titre est mis à jour avec la plage de dates de vos données
- ✅ **Détection automatique des déchetteries** : Toutes les déchetteries sont détectées et traitées
- ✅ **Mapping automatique des catégories** : Les catégories sont automatiquement mappées au format COLLECTES
- ✅ **Formatage professionnel** : Couleurs, bordures et formules appliquées automatiquement
- ✅ **Gestion des erreurs** : Messages d'erreur clairs en français

## 📞 Support

Si vous rencontrez un problème :

1. **Lisez la section "Résolution de Problèmes" ci-dessus**
2. **Vérifiez les messages d'erreur** dans le terminal
3. **Utilisez l'option d'aide** : `python scripts/transform_collectes.py --help`

## 📌 Notes Importantes

- ⚠️ **Ne modifiez pas le fichier d'entrée pendant le traitement**
- ⚠️ **Fermez le fichier Excel s'il est ouvert** avant de lancer le script
- ✅ **Le script utilise automatiquement le premier fichier Excel trouvé** dans `input/` (quel que soit son nom)
- ✅ **Le script lit toujours la première feuille** du fichier Excel (peu importe son nom)
- ✅ **Le script crée automatiquement le dossier `output/`** s'il n'existe pas
- ✅ **Les catégories non mappées sont affichées** dans le terminal (vous pouvez les ignorer)
- ✅ **Le script gère les données manquantes** automatiquement

## 🎯 Exemples Complets

### Exemple avec Interface Graphique

```bash
# 1. Placez votre fichier Excel dans le dossier input/
#    (Le fichier peut avoir n'importe quel nom, ex: mes_donnees.xlsx)

# 2. Ouvrez un terminal dans le dossier du projet

# 3. Lancez l'interface graphique
python scripts/gui_app.py

# 4. Dans l'interface :
#    - Cliquez sur "📁 Utiliser le fichier du dossier 'input'"
#    - Cliquez sur "🚀 Lancer la Transformation"
#    - Attendez le message de succès
#    - Cliquez sur "📂 Ouvrir le dossier de sortie"

# 5. Ouvrez le fichier COLLECTES DECHETERIES T2 2025.xlsx dans Excel
```

### Exemple avec Ligne de Commande

```bash
# 1. Placez votre fichier Excel dans le dossier input/
#    (Le fichier peut avoir n'importe quel nom, ex: mes_donnees.xlsx)

# 2. Ouvrez un terminal dans le dossier du projet

# 3. Lancez le script
python scripts/transform_collectes.py

# 4. Attendez le message "SUCCÈS !"
#    Le script affichera le nom du fichier et de la feuille utilisés

# 5. Ouvrez le fichier output/COLLECTES DECHETERIES T2 2025.xlsx dans Excel
```

C'est aussi simple que ça ! 🎉

## 🚀 Déploiement

### Backend sur Render

1. **Créer un compte Render** : [https://render.com](https://render.com)

2. **Connecter le repository GitHub** :
   - Dans le dashboard Render, cliquez sur "New" > "Web Service"
   - Connectez votre repository GitHub
   - Render détectera automatiquement le fichier `render.yaml`

3. **Configuration automatique** :
   - Le fichier `render.yaml` configure automatiquement :
     - Le service Python avec Gunicorn
     - Le disque persistant pour `input/`, `output/`, et `server/data/`
     - Les variables d'environnement de base

4. **Configurer la variable d'environnement `FRONTEND_URL`** :
   - Une fois le backend déployé, allez dans Render Dashboard > Environment
   - Ajoutez la variable `FRONTEND_URL` avec l'URL de votre frontend GitHub Pages
   - Exemple : `https://username.github.io/` ou `https://username.github.io/repo-name/`
   - Cette URL sera utilisée pour configurer CORS

5. **Note** : Le disque persistant est monté à `/opt/render/project/src` et contient :
   - `input/` : fichiers Excel d'entrée
   - `output/` : fichiers Excel générés
   - `server/data/` : bases de données SQLite

### Frontend sur GitHub Pages

1. **Activer GitHub Pages** :
   - Allez dans votre repository GitHub > Settings > Pages
   - Source : "GitHub Actions"
   - Le workflow `.github/workflows/deploy.yml` se déclenchera automatiquement

2. **Configurer le secret `VITE_API_URL`** :
   - Allez dans Settings > Secrets and variables > Actions
   - Cliquez sur "New repository secret"
   - Nom : `VITE_API_URL`
   - Valeur : l'URL de votre backend Render (ex: `https://gdr-dump-backend.onrender.com`)
   - Si le secret n'est pas défini, la valeur par défaut sera utilisée

3. **Déclencher le déploiement** :
   - Le workflow se déclenche automatiquement à chaque push sur `main`
   - Ou déclenchez-le manuellement : Actions > "Deploy to GitHub Pages" > "Run workflow"

4. **Configuration du base path** (si nécessaire) :
   - Si votre app est dans un sous-dossier (ex: `https://username.github.io/repo-name/`)
   - Décommentez et modifiez `base` dans `vite/vite.config.js` :
     ```js
     base: '/repo-name/'
     ```

5. **Support des routes SPA** :
   - Le fichier `vite/public/404.html` gère automatiquement les routes React Router
   - GitHub Pages redirige les 404 vers ce fichier qui charge l'application

### URLs de production

Après déploiement, vous aurez :
- **Backend** : `https://gdr-dump-backend.onrender.com` (ou votre URL Render personnalisée)
- **Frontend** : `https://username.github.io/` (ou votre URL GitHub Pages)

N'oubliez pas de configurer :
- `FRONTEND_URL` dans Render avec l'URL GitHub Pages
- `VITE_API_URL` dans GitHub Secrets avec l'URL Render (optionnel, valeur par défaut disponible)
