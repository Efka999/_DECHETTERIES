# Guide de Déploiement

Ce guide explique comment déployer l'application sur **GitHub Pages** (frontend) et **Render** (backend).

## Architecture

```
┌─────────────────┐         HTTP Requests         ┌──────────────┐
│  GitHub Pages   │ ────────────────────────────> │    Render    │
│   (Frontend)    │ <──────────────────────────── │  (Backend)   │
│  React Static   │         JSON Responses         │ Flask API    │
└─────────────────┘                               └──────────────┘
```

## Prérequis

- Un compte GitHub avec le repository `_DECHETTERIES`
- Un compte Render (gratuit disponible sur [render.com](https://render.com))
- Les fichiers de configuration sont déjà présents dans le projet

## Étape 1 : Déployer le Backend sur Render

### 1.1 Créer un nouveau Web Service

1. Connectez-vous à [Render Dashboard](https://dashboard.render.com)
2. Cliquez sur **"New +"** puis **"Web Service"**
3. Connectez votre compte GitHub et sélectionnez le repository `_DECHETTERIES`

### 1.2 Configurer le Service

Utilisez les paramètres suivants :

- **Name**: `dechetteries-backend` (ou un nom de votre choix)
- **Environment**: `Python 3`
- **Region**: Choisissez la région la plus proche
- **Branch**: `main` (ou votre branche principale)
- **Root Directory**: Laisser vide (racine du projet)
- **Build Command**: `pip install -r server/requirements.txt`
- **Start Command**: `cd server && gunicorn wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 300`
- **Plan**: Free (ou Starter/Standard selon vos besoins)

### 1.3 Variables d'Environnement

Ajoutez les variables d'environnement suivantes :

- **FRONTEND_URL**: `https://votre-username.github.io/_DECHETTERIES` (à définir après le déploiement GitHub Pages)
  - Remplacez `votre-username` par votre nom d'utilisateur GitHub
  - Si votre repository est dans une organisation, l'URL sera `https://organisation.github.io/_DECHETTERIES`

### 1.4 Noter l'URL du Backend

Une fois le déploiement terminé, notez l'URL de votre service Render :
- Exemple : `https://dechetteries-backend.onrender.com`
- Cette URL sera utilisée pour configurer le frontend

### 1.5 Vérifier le Backend

Testez que le backend fonctionne :
```
https://votre-backend.onrender.com/api/status
```

Vous devriez recevoir une réponse JSON avec `{"status": "ok"}`.

## Étape 2 : Déployer le Frontend sur GitHub Pages

### 2.1 Activer GitHub Pages

1. Allez dans votre repository GitHub : `https://github.com/votre-username/_DECHETTERIES`
2. Cliquez sur **Settings** > **Pages**
3. Sous **Source**, sélectionnez **"GitHub Actions"**
4. Le workflow se déclenchera automatiquement à chaque push sur `main`

### 2.2 Configurer le Secret GitHub

1. Dans votre repository, allez dans **Settings** > **Secrets and variables** > **Actions**
2. Cliquez sur **"New repository secret"**
3. Créez un secret avec :
   - **Name**: `REACT_APP_API_URL`
   - **Value**: L'URL de votre backend Render (ex: `https://dechetteries-backend.onrender.com`)
   - ⚠️ **Important** : N'incluez PAS de slash final (`/`) à la fin de l'URL

### 2.3 Déclencher le Déploiement

1. Le workflow GitHub Actions se déclenche automatiquement à chaque push sur `main`
2. Vous pouvez aussi le déclencher manuellement :
   - Allez dans **Actions** > **Deploy to GitHub Pages**
   - Cliquez sur **"Run workflow"**

### 2.4 Vérifier le Déploiement

1. Allez dans **Settings** > **Pages** pour voir l'URL de votre site
2. L'URL sera généralement : `https://votre-username.github.io/_DECHETTERIES`
3. Si votre repository est dans une organisation, l'URL peut être différente

### 2.5 Mettre à jour FRONTEND_URL sur Render

Une fois que vous connaissez l'URL exacte de votre frontend GitHub Pages :

1. Retournez sur Render Dashboard
2. Allez dans votre service backend
3. Cliquez sur **Environment**
4. Mettez à jour la variable `FRONTEND_URL` avec l'URL exacte de GitHub Pages
5. Redéployez le service si nécessaire

## Étape 3 : Configuration React Router

Le fichier `vite/public/_redirects` est déjà configuré pour gérer les routes React Router sur GitHub Pages. Ce fichier redirige toutes les routes vers `index.html` pour que React Router fonctionne correctement.

## Étape 4 : Tests Post-Déploiement

### 4.1 Vérifier le Backend

```bash
curl https://votre-backend.onrender.com/api/status
```

Réponse attendue :
```json
{"status": "ok", "message": "Serveur opérationnel"}
```

### 4.2 Vérifier le Frontend

1. Ouvrez votre site GitHub Pages dans un navigateur
2. Vérifiez que la page se charge correctement
3. Ouvrez la console du navigateur (F12) et vérifiez qu'il n'y a pas d'erreurs CORS

### 4.3 Tester les Fonctionnalités

1. **Upload de fichier** :
   - Sélectionnez un fichier Excel dans le dossier `input/`
   - Cliquez sur "Transformer"
   - Vérifiez que le fichier est traité correctement

2. **Téléchargement** :
   - Après la transformation, cliquez sur "Télécharger"
   - Vérifiez que le fichier se télécharge correctement

3. **Statistiques** :
   - Allez sur la page "Statistiques"
   - Vérifiez que les graphiques s'affichent correctement

## Dépannage

### Problème : Erreurs CORS

**Symptôme** : Erreur dans la console du navigateur : `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**Solution** :
1. Vérifiez que `FRONTEND_URL` sur Render correspond exactement à l'URL de GitHub Pages
2. Vérifiez qu'il n'y a pas de slash final dans `FRONTEND_URL`
3. Redéployez le backend sur Render

### Problème : Le frontend ne se connecte pas au backend

**Symptôme** : Message "Le serveur ne répond pas" dans l'interface

**Solution** :
1. Vérifiez que le secret `REACT_APP_API_URL` est correctement configuré dans GitHub
2. Vérifiez que l'URL du backend est accessible (testez avec curl ou un navigateur)
3. Vérifiez que le backend est bien déployé et en cours d'exécution sur Render

### Problème : Les routes React Router ne fonctionnent pas

**Symptôme** : Erreur 404 quand on accède directement à une route (ex: `/stats`)

**Solution** :
1. Vérifiez que le fichier `vite/public/_redirects` existe
2. Vérifiez que le fichier contient : `/*    /index.html   200`
3. Redéployez le frontend

### Problème : Le backend se met en veille (Free Plan)

**Symptôme** : Le backend prend du temps à répondre après une période d'inactivité

**Explication** : Sur le plan gratuit de Render, les services se mettent en veille après 15 minutes d'inactivité. Le premier appel après la mise en veille peut prendre 30-60 secondes.

**Solution** :
- Utilisez un service de "ping" automatique (ex: [UptimeRobot](https://uptimerobot.com)) pour maintenir le service actif
- Ou passez à un plan payant pour éviter la mise en veille

## Mise à Jour

### Mettre à jour le Backend

1. Faites vos modifications dans le code
2. Commitez et poussez sur `main`
3. Render détectera automatiquement les changements et redéploiera

### Mettre à jour le Frontend

1. Faites vos modifications dans le code
2. Commitez et poussez sur `main`
3. Le workflow GitHub Actions se déclenchera automatiquement et redéploiera

## URLs de Référence

- **Backend API** : `https://votre-backend.onrender.com`
- **Frontend** : `https://votre-username.github.io/_DECHETTERIES`
- **Documentation Render** : [https://render.com/docs](https://render.com/docs)
- **Documentation GitHub Pages** : [https://docs.github.com/en/pages](https://docs.github.com/en/pages)

## Support

En cas de problème, vérifiez :
1. Les logs du backend sur Render Dashboard
2. Les logs du workflow GitHub Actions
3. La console du navigateur pour les erreurs frontend
