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

// ============================================================================
// Dump API functions
// ============================================================================

export const importDumpFile = async (filePath, year = 2025, force = false) => {
  try {
    const response = await api.post('/db/dump/import', {
      file_path: filePath,
      force: force
    }, {
      params: { year }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors de l\'import du dump');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

export const getDumpStatus = async (year = 2025) => {
  try {
    const response = await api.get('/db/dump/status', {
      params: { year }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors du chargement du statut');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

export const getDumpStats = async (year = 2025) => {
  try {
    const response = await api.get('/db/dump/stats', {
      params: { year }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors du chargement des statistiques');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

export const getDumpRawData = async (limit = 50, offset = 0, year = 2025, filters = {}) => {
  try {
    const params = {
      limit,
      offset,
      year,
      ...filters
    };
    const response = await api.get('/db/dump/raw', { params });
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

export const getDumpRawDataOptions = async (year = 2025) => {
  try {
    const response = await api.get('/db/dump/raw/options', {
      params: { year }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors du chargement des options');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

export const getDumpTimeSeries = async (granularity = 'day', year = 2025) => {
  try {
    const response = await api.get('/db/dump/stats/advanced/series', {
      params: { granularity, year }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors du chargement des séries temporelles');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

export const getDumpCategoryStats = async (year = 2025) => {
  try {
    const response = await api.get('/db/dump/stats/advanced/category', {
      params: { year }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors du chargement des stats par catégorie');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

export const getDumpFluxOrientationMatrix = async (year = 2025) => {
  try {
    const response = await api.get('/db/dump/stats/advanced/flux-orientation', {
      params: { year }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors du chargement de la matrice flux/orientation');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

export const getDumpAnomalies = async (limit = 10, year = 2025) => {
  try {
    const response = await api.get('/db/dump/stats/advanced/anomalies', {
      params: { limit, year }
    });
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

export const getDumpMissingDays = async (year = 2025) => {
  try {
    const response = await api.get('/db/dump/stats/advanced/missing-days', {
      params: { year }
    });
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

export const getDumpComparison = async (year = 2025) => {
  try {
    const response = await api.get('/db/dump/stats/advanced/comparison', {
      params: { year }
    });
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

export const getDumpAvailableYears = async () => {
  try {
    const response = await api.get('/db/dump/years');
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors du chargement des années');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};

// ============================================================================
// File management functions
// ============================================================================

export const listOutputFiles = async () => {
  try {
    const response = await api.get('/files/output/list');
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Erreur lors du chargement des fichiers');
    } else {
      throw new Error('Erreur lors du chargement des fichiers');
    }
  }
};

export const downloadOutputFile = async (filename) => {
  try {
    const response = await api.get(`/files/output/download/${encodeURIComponent(filename)}`, {
      responseType: 'blob'
    });
    
    // Create a blob URL and trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return { success: true, filename };
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Erreur lors du téléchargement');
    } else {
      throw new Error('Erreur lors du téléchargement');
    }
  }
};

export const listInputFiles = async () => {
  try {
    const response = await api.get('/files/input/list');
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Erreur lors du chargement des fichiers');
    } else {
      throw new Error('Erreur lors du chargement des fichiers');
    }
  }
};

export const uploadInputFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/files/input/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Erreur lors de l\'upload');
    } else {
      throw new Error('Erreur lors de l\'upload');
    }
  }
};
