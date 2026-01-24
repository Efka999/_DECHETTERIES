/**
 * Client API pour communiquer avec le backend
 */

import axios from 'axios';

// Utiliser le proxy Vite si VITE_API_URL n'est pas défini
// Le proxy gère automatiquement HTTP/HTTPS selon la configuration
const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : '/api', // Utiliser le proxy si pas d'URL définie
  timeout: 300000, // 5 minutes pour les gros fichiers
});

/**
 * Vérifie que le serveur est opérationnel
 */
export const checkStatus = async () => {
  try {
    const response = await api.get('/status');
    return response.data;
  } catch (error) {
    throw new Error('Le serveur ne répond pas');
  }
};

/**
 * Transforme un fichier Excel
 * @param {File} file - Fichier Excel à transformer
 * @returns {Promise} Résultat de la transformation
 */
export const transformFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await api.post('/transform', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        // Peut être utilisé pour afficher la progression
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        console.log(`Upload: ${percentCompleted}%`);
      },
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      // Le serveur a répondu avec un code d'erreur
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors de la transformation');
    } else if (error.request) {
      // La requête a été faite mais aucune réponse n'a été reçue
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      // Erreur lors de la configuration de la requête
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

/**
 * Télécharge le fichier généré
 * @param {string} filename - Nom du fichier à télécharger
 * @param {string} filePath - Chemin complet du fichier (optionnel, pour recherche)
 */
export const downloadFile = (filename, filePath = null) => {
  // Extraire juste le nom du fichier pour l'URL
  const fileToDownload = filename.includes('/') 
    ? filename.split('/').pop() 
    : filename;
  
  // L'API cherche dans output/, donc on passe juste le nom du fichier
  const url = `${API_URL}/api/download/${encodeURIComponent(fileToDownload)}`;
  
  // Créer un lien temporaire pour forcer le téléchargement
  const link = document.createElement('a');
  link.href = url;
  link.download = fileToDownload;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Récupère les statistiques du fichier Excel de sortie
 * @param {string} filename - Nom du fichier (peut contenir le chemin)
 * @returns {Promise} Statistiques du fichier
 */
export const getStats = async (filename = null) => {
  try {
    const url = filename
      ? `/stats/${encodeURIComponent(filename)}`
      : '/stats';
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    if (error.response) {
      const errorData = error.response.data;
      const errorMsg = errorData.error || errorData.message || 'Erreur lors de la récupération des statistiques';
      // Si des fichiers sont disponibles, les inclure dans le message
      if (errorData.available_files && errorData.available_files.length > 0) {
        throw new Error(`${errorMsg}. Fichiers disponibles: ${errorData.available_files.join(', ')}`);
      }
      throw new Error(errorMsg);
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

/**
 * Génère le fichier annuel combiné T1+T2
 * @param {number} year - Année pour le fichier de sortie (défaut: 2025)
 * @returns {Promise} Résultat de la génération
 */
export const generateAnnualFile = async (year = 2025) => {
  try {
    const response = await api.post('/transform/annual', { year });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors de la génération du fichier annuel');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

/**
 * Ingestion des fichiers Excel du dossier input/ dans la base
 * @param {boolean} force - Réimporter même si déjà ingéré
 */
export const importRawData = async (force = false) => {
  try {
    const response = await api.post('/db/import', { force });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors de l\'ingestion');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

/**
 * Statut de la base de données
 */
export const getDbStatus = async () => {
  try {
    const response = await api.get('/db/status');
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors du statut DB');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

/**
 * Récupère les données brutes depuis la base
 * @param {number} limit - Nombre de lignes
 * @param {number} offset - Décalage
 */
export const getRawData = async (limit = 50, offset = 0) => {
  try {
    const response = await api.get('/db/raw', {
      params: { limit, offset }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors du chargement des données brutes');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

export const rebuildAggregates = async () => {
  try {
    const response = await api.post('/db/rebuild-aggregates');
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors de la reconstruction');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

export const getAdvancedSeries = async (granularity = 'day') => {
  try {
    const response = await api.get('/stats/advanced/series', { params: { granularity } });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors du chargement des séries');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

export const getAdvancedCategory = async () => {
  try {
    const response = await api.get('/stats/advanced/category');
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors du chargement des catégories');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

export const getAdvancedFluxOrientation = async () => {
  try {
    const response = await api.get('/stats/advanced/flux-orientation');
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors du chargement des flux');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

export const getAdvancedAnomalies = async (limit = 10) => {
  try {
    const response = await api.get('/stats/advanced/anomalies', { params: { limit } });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors du chargement des anomalies');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

export const getAdvancedMissingDays = async () => {
  try {
    const response = await api.get('/stats/advanced/missing-days');
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors du chargement des jours manquants');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

export const getAdvancedComparison = async () => {
  try {
    const response = await api.get('/stats/advanced/comparison');
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors du chargement des comparaisons');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};
