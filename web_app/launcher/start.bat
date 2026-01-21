@echo off
REM Launcher pour démarrer l'application web React + Flask
REM Démarre le backend Flask et ouvre le navigateur

echo ========================================
echo   Application Web Transformation Dechetteries
echo ========================================
echo.

REM Obtenir le chemin du script
set "LAUNCHER_DIR=%~dp0"
set "WEB_APP_DIR=%LAUNCHER_DIR%.."
set "BACKEND_DIR=%WEB_APP_DIR%\backend"
set "FRONTEND_DIR=%WEB_APP_DIR%\frontend"

REM Vérifier que Python est installé
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Python n'est pas installe ou n'est pas dans le PATH
    echo Veuillez installer Python depuis https://www.python.org/
    pause
    exit /b 1
)

echo [OK] Python detecte
echo.

REM Aller dans le dossier backend
cd /d "%BACKEND_DIR%"

REM Vérifier que les dépendances sont installées
echo [INFO] Verification des dependances backend...
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installation des dependances backend...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERREUR] Impossible d'installer les dependances
        pause
        exit /b 1
    )
)

echo [OK] Dependances backend OK
echo.

REM Vérifier que Node.js est installé (pour React)
node --version >nul 2>&1
if errorlevel 1 (
    echo [ATTENTION] Node.js n'est pas installe
    echo Le frontend React ne pourra pas etre demarre automatiquement
    echo Installez Node.js depuis https://nodejs.org/
    echo.
    echo Demarrage du backend uniquement...
    echo.
    start "Backend Flask" python app.py
    echo.
    echo Backend demarre sur http://localhost:5000
    echo Vous pouvez acceder a l'API directement
    pause
    exit /b 0
)

echo [OK] Node.js detecte
echo.

REM Vérifier que les dépendances frontend sont installées
cd /d "%FRONTEND_DIR%"
if not exist "node_modules" (
    echo [INFO] Installation des dependances frontend...
    echo Cela peut prendre plusieurs minutes...
    call npm install
    if errorlevel 1 (
        echo [ERREUR] Impossible d'installer les dependances frontend
        pause
        exit /b 1
    )
)

echo [OK] Dependances frontend OK
echo.

REM Démarrer le backend dans une nouvelle fenêtre
echo [INFO] Demarrage du backend Flask...
start "Backend Flask" /D "%BACKEND_DIR%" python app.py

REM Attendre un peu que le backend démarre
timeout /t 3 /nobreak >nul

REM Démarrer le frontend React
echo [INFO] Demarrage du frontend React...
echo [INFO] Le navigateur va s'ouvrir automatiquement...
echo.
cd /d "%FRONTEND_DIR%"
start "Frontend React" /D "%FRONTEND_DIR%" npm start

echo.
echo ========================================
echo   Application demarree !
echo ========================================
echo.
echo Backend  : http://localhost:5000
echo Frontend : http://localhost:3000
echo.
echo Appuyez sur Ctrl+C dans cette fenetre pour arreter les serveurs
echo.
pause
