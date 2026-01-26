import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readFileSync } from 'fs'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Charger les variables d'environnement depuis .env
config({ path: path.join(__dirname, '.env') })

// Fonction pour charger les certificats HTTPS
function loadHttpsConfig() {
  // Activer HTTPS si VITE_USE_HTTPS=true ou si USE_HTTPS=true (pour cohérence)
  const useHttps = process.env.VITE_USE_HTTPS === 'true' || process.env.USE_HTTPS === 'true';
  
  if (!useHttps) {
    return false;
  }
  
  console.log('[HTTPS] Configuration HTTPS activée');
  console.log('[HTTPS] VITE_USE_HTTPS:', process.env.VITE_USE_HTTPS);
  console.log('[HTTPS] USE_HTTPS:', process.env.USE_HTTPS);
  
  // Option 1: Certificats dans vite/certs/
  const viteCertDir = path.join(__dirname, 'certs');
  const viteCert = path.join(viteCertDir, 'cert.pem');
  const viteKey = path.join(viteCertDir, 'key.pem');
  
  // Option 2: Certificats dans server/certs/ (partagés)
  const serverCertDir = path.join(__dirname, '../server/certs');
  const serverCert = path.join(serverCertDir, 'cert.pem');
  const serverKey = path.join(serverCertDir, 'key.pem');
  
  // Option 3: Variables d'environnement
  const envCert = process.env.VITE_SSL_CERT;
  const envKey = process.env.VITE_SSL_KEY;
  
  let certPath, keyPath;
  
  if (envCert && envKey && existsSync(envCert) && existsSync(envKey)) {
    certPath = envCert;
    keyPath = envKey;
    console.log('[HTTPS] Utilisation des certificats depuis les variables d\'environnement');
  } else if (existsSync(viteCert) && existsSync(viteKey)) {
    certPath = viteCert;
    keyPath = viteKey;
    console.log('[HTTPS] Utilisation des certificats depuis vite/certs/');
  } else if (existsSync(serverCert) && existsSync(serverKey)) {
    certPath = serverCert;
    keyPath = serverKey;
    console.log('[HTTPS] Utilisation des certificats depuis server/certs/');
  } else {
    console.warn('[WARN] HTTPS activé mais certificats introuvables.');
    console.warn('[WARN] Cherché dans:');
    console.warn(`  - ${viteCert}`);
    console.warn(`  - ${serverCert}`);
    console.warn('[WARN] Démarrage en HTTP.');
    return false;
  }
  
  console.log(`[HTTPS] Certificat: ${certPath}`);
  console.log(`[HTTPS] Clé: ${keyPath}`);
  
  try {
    return {
      cert: readFileSync(certPath),
      key: readFileSync(keyPath),
    };
  } catch (error) {
    console.error('[ERREUR] Impossible de lire les certificats:', error.message);
    return false;
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.js', '.jsx', '.json'],
  },
  server: {
    port: 5173,
    https: loadHttpsConfig(),
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || (process.env.USE_HTTPS === 'true' ? 'https://localhost:5000' : 'http://localhost:5000'),
        changeOrigin: true,
        secure: false, // Accepter les certificats auto-signés
      },
    },
  },
  // Base path pour GitHub Pages
  // Utilise VITE_BASE_PATH si défini, sinon détecte depuis GITHUB_REPOSITORY, sinon fallback
  base: process.env.VITE_BASE_PATH || 
        (process.env.GITHUB_REPOSITORY && !process.env.GITHUB_REPOSITORY.split('/')[1].endsWith('.github.io') 
          ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/` 
          : '/_DECHETTERIES/'),
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
