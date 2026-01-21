/**
 * Client API pour communiquer avec le backend
 */

import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
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
export const getStats = async (filename) => {
  try {
    const response = await api.get(`/stats/${encodeURIComponent(filename)}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || error.response.data.message || 'Erreur lors de la récupération des statistiques');
    } else if (error.request) {
      throw new Error('Le serveur ne répond pas. Vérifiez qu\'il est démarré.');
    } else {
      throw new Error(error.message || 'Erreur inconnue');
    }
  }
};
