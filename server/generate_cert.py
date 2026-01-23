"""
Script pour générer un certificat SSL auto-signé pour le développement
Usage: python generate_cert.py
"""

import os
import subprocess
import sys
from pathlib import Path

def generate_self_signed_cert():
    """Génère un certificat SSL auto-signé pour le développement local"""
    
    backend_dir = Path(__file__).parent
    cert_dir = backend_dir / 'certs'
    cert_dir.mkdir(exist_ok=True)
    
    cert_file = cert_dir / 'cert.pem'
    key_file = cert_dir / 'key.pem'
    
    # Vérifier si les certificats existent déjà
    if cert_file.exists() and key_file.exists():
        print(f"[INFO] Les certificats existent déjà dans {cert_dir}")
        print(f"[INFO] Certificat: {cert_file}")
        print(f"[INFO] Clé privée: {key_file}")
        return str(cert_file), str(key_file)
    
    print("[INFO] Génération d'un certificat SSL auto-signé pour le développement...")
    print("[INFO] Ce certificat n'est valable que pour localhost et 127.0.0.1")
    print("")
    
    # Créer le fichier de configuration OpenSSL avec SAN
    openssl_config = f"""[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = FR
ST = France
L = Local
O = Development
CN = localhost

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
"""
    
    config_file = cert_dir / 'openssl.conf'
    with open(config_file, 'w') as f:
        f.write(openssl_config)
    
    # Commande OpenSSL pour générer le certificat avec SAN
    openssl_cmd = [
        'openssl', 'req', '-x509', '-newkey', 'rsa:4096',
        '-nodes', '-out', str(cert_file),
        '-keyout', str(key_file),
        '-days', '365',
        '-config', str(config_file),
        '-extensions', 'v3_req'
    ]
    
    try:
        # Vérifier si OpenSSL est installé
        subprocess.run(['openssl', 'version'], check=True, capture_output=True)
        
        # Générer le certificat
        result = subprocess.run(
            openssl_cmd,
            check=True,
            capture_output=True,
            text=True
        )
        
        print(f"[OK] Certificat généré avec succès!")
        print(f"[OK] Certificat: {cert_file}")
        print(f"[OK] Clé privée: {key_file}")
        print("")
        
        # Créer des copies pour le frontend Vite (optionnel)
        project_root = backend_dir.parent
        vite_dir = project_root / 'vite'
        if vite_dir.exists():
            vite_certs_dir = vite_dir / 'certs'
            vite_certs_dir.mkdir(exist_ok=True)
            import shutil
            shutil.copy2(cert_file, vite_certs_dir / 'cert.pem')
            shutil.copy2(key_file, vite_certs_dir / 'key.pem')
            print(f"[OK] Certificats copiés pour Vite dans: {vite_certs_dir}")
            print("")
        
        print("[ATTENTION] Ce certificat est auto-signé et générera un avertissement")
        print("           de sécurité dans le navigateur. C'est normal en développement.")
        print("")
        print("Pour accepter le certificat dans votre navigateur:")
        print("  - Backend: https://localhost:5000")
        print("  - Frontend: https://localhost:5173")
        print("  Cliquez sur 'Avancé' puis 'Continuer vers localhost'")
        print("")
        
        return str(cert_file), str(key_file)
        
    except subprocess.CalledProcessError as e:
        print(f"[ERREUR] Erreur lors de la génération du certificat: {e}")
        print(f"[INFO] Sortie: {e.stderr}")
        sys.exit(1)
    except FileNotFoundError:
        print("[ERREUR] OpenSSL n'est pas installé ou n'est pas dans le PATH")
        print("")
        print("Pour installer OpenSSL:")
        print("  - Windows: Téléchargez depuis https://slproweb.com/products/Win32OpenSSL.html")
        print("             ou utilisez: choco install openssl")
        print("  - macOS:   brew install openssl")
        print("  - Linux:   sudo apt-get install openssl (Debian/Ubuntu)")
        print("             sudo yum install openssl (CentOS/RHEL)")
        sys.exit(1)

if __name__ == '__main__':
    cert_file, key_file = generate_self_signed_cert()
    print(f"Certificat: {cert_file}")
    print(f"Clé: {key_file}")
