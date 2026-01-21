# Launcher PowerShell pour démarrer l'application web React + Flask
# Démarre le backend Flask et le frontend React

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Application Web Transformation Dechetteries" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Obtenir le chemin du script
$LauncherDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WebAppDir = Split-Path -Parent $LauncherDir
$BackendDir = Join-Path $WebAppDir "backend"
$FrontendDir = Join-Path $WebAppDir "frontend"

# Vérifier que Python est installé
try {
    $pythonVersion = python --version 2>&1
    Write-Host "[OK] Python detecte : $pythonVersion" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "[ERREUR] Python n'est pas installe ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "Veuillez installer Python depuis https://www.python.org/" -ForegroundColor Yellow
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

# Aller dans le dossier backend
Set-Location $BackendDir

# Vérifier que les dépendances sont installées
Write-Host "[INFO] Verification des dependances backend..." -ForegroundColor Yellow
try {
    python -c "import flask" 2>&1 | Out-Null
    Write-Host "[OK] Dependances backend OK" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "[INFO] Installation des dependances backend..." -ForegroundColor Yellow
    python -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERREUR] Impossible d'installer les dependances" -ForegroundColor Red
        Read-Host "Appuyez sur Entree pour quitter"
        exit 1
    }
    Write-Host "[OK] Dependances backend installees" -ForegroundColor Green
    Write-Host ""
}

# Vérifier que Node.js est installé
try {
    $nodeVersion = node --version 2>&1
    Write-Host "[OK] Node.js detecte : $nodeVersion" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "[ATTENTION] Node.js n'est pas installe" -ForegroundColor Yellow
    Write-Host "Le frontend React ne pourra pas etre demarre automatiquement" -ForegroundColor Yellow
    Write-Host "Installez Node.js depuis https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Demarrage du backend uniquement..." -ForegroundColor Yellow
    Write-Host ""
    
    Start-Process python -ArgumentList "app.py" -WorkingDirectory $BackendDir -WindowStyle Normal
    Write-Host "Backend demarre sur http://localhost:5000" -ForegroundColor Green
    Write-Host "Vous pouvez acceder a l'API directement" -ForegroundColor Yellow
    Read-Host "Appuyez sur Entree pour quitter"
    exit 0
}

# Vérifier que les dépendances frontend sont installées
Set-Location $FrontendDir
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Installation des dependances frontend..." -ForegroundColor Yellow
    Write-Host "Cela peut prendre plusieurs minutes..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERREUR] Impossible d'installer les dependances frontend" -ForegroundColor Red
        Read-Host "Appuyez sur Entree pour quitter"
        exit 1
    }
    Write-Host "[OK] Dependances frontend installees" -ForegroundColor Green
    Write-Host ""
}

# Démarrer le backend dans une nouvelle fenêtre PowerShell
Write-Host "[INFO] Demarrage du backend Flask..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendDir'; python app.py" -WindowStyle Normal

# Attendre un peu que le backend démarre
Start-Sleep -Seconds 3

# Démarrer le frontend React
Write-Host "[INFO] Demarrage du frontend React..." -ForegroundColor Cyan
Write-Host "[INFO] Le navigateur va s'ouvrir automatiquement..." -ForegroundColor Yellow
Write-Host ""
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendDir'; npm start" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Application demarree !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend  : http://localhost:5000" -ForegroundColor Cyan
Write-Host "Frontend : http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Fermez les fenetres PowerShell pour arreter les serveurs" -ForegroundColor Yellow
Write-Host ""
Read-Host "Appuyez sur Entree pour quitter"
