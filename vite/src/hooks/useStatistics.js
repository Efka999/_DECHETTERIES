import { useState, useEffect } from 'react';
import { getStats } from '../services/api';
import { combineStats, inferYearFromFilename } from '../utils/statistics';

export const useStatistics = (outputFilename, year = null) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      // DB-backed stats only
      let dbResult = null;
      try {
        dbResult = await getStats(null, year);
        if (dbResult && dbResult.success) {
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

  const datasetYear = stats?.dataset_year || inferYearFromFilename(outputFilename);

  return { stats, loading, error, loadStats, datasetYear };
};
