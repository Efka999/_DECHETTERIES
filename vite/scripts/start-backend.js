#!/usr/bin/env node
/**
 * Script pour démarrer le backend Flask
 * Fonctionne sur Windows, Linux et Mac
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement depuis .env
config({ path: join(__dirname, '../.env') });

// Chemin vers le backend
const projectRoot = join(__dirname, '../..');
const backendDir = join(projectRoot, 'server');
const appPy = join(backendDir, 'app.py');

if (!existsSync(appPy)) {
  console.error(`[ERREUR] Fichier app.py introuvable: ${appPy}`);
  process.exit(1);
}

// Détecter le système d'exploitation
const isWindows = process.platform === 'win32';
const pythonCmd = isWindows ? 'python' : 'python3';

// Vérifier si HTTPS est activé
const useHttps = process.env.USE_HTTPS === 'true';

console.log(`[INFO] Démarrage du backend Flask...`);
console.log(`[INFO] Répertoire: ${backendDir}`);
console.log(`[INFO] USE_HTTPS=${process.env.USE_HTTPS || 'non défini'}`);
console.log(`[INFO] HTTPS: ${useHttps ? 'Activé' : 'Désactivé'}`);
if (useHttps) {
  console.log(`[INFO] Pour générer les certificats: cd ${backendDir} && python generate_cert.py`);
} else {
  console.log(`[INFO] Pour activer HTTPS: définissez USE_HTTPS=true`);
}
console.log(`[INFO] Commande: ${pythonCmd} app.py`);
console.log('');

// Préparer les variables d'environnement - copier toutes les variables et s'assurer que USE_HTTPS est bien passé
const env = { ...process.env };
// Forcer USE_HTTPS si défini dans le processus parent
if (process.env.USE_HTTPS === 'true') {
  env.USE_HTTPS = 'true';
  console.log(`[DEBUG] Variable USE_HTTPS=${env.USE_HTTPS} sera passée au backend`);
}

// Démarrer le backend
const backend = spawn(pythonCmd, ['app.py'], {
  cwd: backendDir,
  stdio: 'inherit',
  shell: isWindows,
  env: env
});

backend.on('error', (error) => {
  console.error(`[ERREUR] Impossible de démarrer le backend: ${error.message}`);
  console.error(`[INFO] Assurez-vous que Python est installé et dans le PATH`);
  process.exit(1);
});

backend.on('exit', (code) => {
  if (code !== 0) {
    console.error(`[ERREUR] Le backend s'est arrêté avec le code ${code}`);
    process.exit(code);
  }
});

// Gérer l'arrêt propre
process.on('SIGINT', () => {
  console.log('\n[INFO] Arrêt du backend...');
  backend.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[INFO] Arrêt du backend...');
  backend.kill();
  process.exit(0);
});
