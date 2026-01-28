import { useState, useEffect } from 'react';
import { getDumpStats } from '../services/api';

export const useStatistics = (outputFilename, year = null) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      // Utiliser uniquement le dump
      let dbResult = null;
      try {
        dbResult = await getDumpStats(year || 2025);
        if (dbResult && dbResult.success && dbResult.stats) {
          // Vérification supplémentaire : s'assurer que global_totals existe
          if (!dbResult.stats.global_totals) {
            console.error('[useStatistics] Missing global_totals in stats:', dbResult.stats);
            setError('Format de données invalide : global_totals manquant');
            setStats(null);
            return;
          }
          setStats(dbResult.stats);
          return;
        }
      } catch (dbError) {
        dbResult = { success: false, error: dbError?.message };
      }

      setStats(null);
      setError(dbResult?.error || 'Aucune donnée disponible pour cette année.');
      return;

    } catch (err) {
      console.error('Error loading stats:', err);
      setError(err.message || 'Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Always try to load stats, even if no filename is provided
    // This will attempt to load the annual file by default
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputFilename, year]);

  const datasetYear = stats?.dataset_year || year;

  return { stats, loading, error, loadStats, datasetYear };
};
