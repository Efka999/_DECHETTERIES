#!/bin/bash
# Launcher pour démarrer l'application web React + Flask (Linux/Mac)
# Démarre le backend Flask et le frontend React

echo "========================================"
echo "  Application Web Transformation Dechetteries"
echo "========================================"
echo ""

# Obtenir le chemin du script
LAUNCHER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_APP_DIR="$(dirname "$LAUNCHER_DIR")"
BACKEND_DIR="$WEB_APP_DIR/backend"
FRONTEND_DIR="$WEB_APP_DIR/frontend"

# Vérifier que Python est installé
if ! command -v python3 &> /dev/null; then
    echo "[ERREUR] Python 3 n'est pas installé"
    echo "Veuillez installer Python 3 depuis https://www.python.org/"
    exit 1
fi

echo "[OK] Python détecté : $(python3 --version)"
echo ""

# Aller dans le dossier backend
cd "$BACKEND_DIR"

# Vérifier que les dépendances sont installées
echo "[INFO] Vérification des dépendances backend..."
if ! python3 -c "import flask" 2>/dev/null; then
    echo "[INFO] Installation des dépendances backend..."
    pip3 install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "[ERREUR] Impossible d'installer les dépendances"
        exit 1
    fi
fi

echo "[OK] Dépendances backend OK"
echo ""

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
    echo "[ATTENTION] Node.js n'est pas installé"
    echo "Le frontend React ne pourra pas être démarré automatiquement"
    echo "Installez Node.js depuis https://nodejs.org/"
    echo ""
    echo "Démarrage du backend uniquement..."
    echo ""
    python3 app.py &
    echo "Backend démarré sur http://localhost:5000"
    echo "Vous pouvez accéder à l'API directement"
    exit 0
fi

echo "[OK] Node.js détecté : $(node --version)"
echo ""

# Vérifier que les dépendances frontend sont installées
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installation des dépendances frontend..."
    echo "Cela peut prendre plusieurs minutes..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERREUR] Impossible d'installer les dépendances frontend"
        exit 1
    fi
fi

echo "[OK] Dépendances frontend OK"
echo ""

# Fonction pour nettoyer les processus à l'arrêt
cleanup() {
    echo ""
    echo "Arrêt des serveurs..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Démarrer le backend en arrière-plan
echo "[INFO] Démarrage du backend Flask..."
cd "$BACKEND_DIR"
python3 app.py &
BACKEND_PID=$!

# Attendre un peu que le backend démarre
sleep 3

# Démarrer le frontend React
echo "[INFO] Démarrage du frontend React..."
echo "[INFO] Le navigateur va s'ouvrir automatiquement..."
echo ""
cd "$FRONTEND_DIR"
npm start &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "  Application démarrée !"
echo "========================================"
echo ""
echo "Backend  : http://localhost:5000"
echo "Frontend : http://localhost:3000"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter les serveurs"
echo ""

# Attendre que les processus se terminent
wait
