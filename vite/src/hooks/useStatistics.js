import { useState, useEffect } from 'react';
import { getStats } from '../services/api';
import { combineStats, inferYearFromFilename } from '../utils/statistics';

export const useStatistics = (outputFilename) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try DB-backed stats first
      try {
        const dbResult = await getStats();
        if (dbResult && dbResult.success) {
          setStats(dbResult.stats);
          return;
        }
      } catch (dbError) {
        console.log('DB stats unavailable, fallback to Excel outputs.');
      }

      // If provided filename, try that first
      if (outputFilename) {
        const filename = outputFilename.includes('/')
          ? outputFilename.split('/').pop()
          : outputFilename;
        try {
          const providedResult = await getStats(filename);
          if (providedResult && providedResult.success) {
            setStats(providedResult.stats);
            try {
              localStorage.setItem('last_output_filename', filename);
            } catch (storageError) {
              // Ignore storage failures
            }
            return;
          }
        } catch (err) {
          console.log(`Provided file not found: ${filename}`);
        }
      }
      
      // Load T1 and T2 in parallel, but wait for both before combining
      console.log('Loading T1 and T2 files...');
      const [t1Result, t2Result] = await Promise.allSettled([
        getStats('COLLECTES DECHETERIES T1 2025.xlsx').catch(err => {
          console.log('T1 file not found or error:', err.message);
          return null;
        }),
        getStats('COLLECTES DECHETERIES T2 2025.xlsx').catch(err => {
          console.log('T2 file not found or error:', err.message);
          return null;
        })
      ]);
      
      const t1 = t1Result.status === 'fulfilled' && t1Result.value?.success ? t1Result.value : null;
      const t2 = t2Result.status === 'fulfilled' && t2Result.value?.success ? t2Result.value : null;
      
      if (t1) {
        console.log('T1 file loaded successfully:', {
          dechetteries: Object.keys(t1.stats.dechetteries || {}),
          months: t1.stats.months_order
        });
      }
      
      if (t2) {
        console.log('T2 file loaded successfully:', {
          dechetteries: Object.keys(t2.stats.dechetteries || {}),
          months: t2.stats.months_order
        });
      }
      
      // Combine T1 and T2 if both exist
      if (t1 && t2) {
        console.log('Both T1 and T2 loaded, combining...');
        const combinedStats = combineStats(t1.stats, t2.stats);
        if (combinedStats) {
          const firstDech = Object.keys(combinedStats.dechetteries)[0];
          const firstDechData = firstDech ? combinedStats.dechetteries[firstDech] : null;
          const t1Months = ['JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN'];
          const t2Months = ['JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE'];
          
          console.log('Combined stats created:', {
            dechetteries: Object.keys(combinedStats.dechetteries),
            months: combinedStats.months_order,
            globalTotal: combinedStats.global_totals.TOTAL,
            sampleDechetterie: firstDech ? {
              name: firstDech,
              allMonths: Object.keys(firstDechData.months || {}),
              t1MonthsData: t1Months.map(m => ({
                month: m,
                total: firstDechData.months?.[m]?.TOTAL || 0,
                hasData: firstDechData.months?.[m] ? Object.keys(firstDechData.months[m]).length > 0 : false
              })),
              t2MonthsData: t2Months.map(m => ({
                month: m,
                total: firstDechData.months?.[m]?.TOTAL || 0,
                hasData: firstDechData.months?.[m] ? Object.keys(firstDechData.months[m]).length > 0 : false
              }))
            } : null
          });
          setStats(combinedStats);
          try {
            localStorage.setItem('last_output_filename', 'COLLECTES DECHETERIES T1+T2 2025.xlsx');
          } catch (storageError) {
            // Ignore storage failures
          }
        } else {
          setError('Erreur lors de la combinaison des données T1 et T2');
        }
      } else if (t1) {
        // Only T1 available
        console.log('Only T1 available, using T1 data');
        setStats(t1.stats);
        try {
          localStorage.setItem('last_output_filename', 'COLLECTES DECHETERIES T1 2025.xlsx');
        } catch (storageError) {
          // Ignore storage failures
        }
      } else if (t2) {
        // Only T2 available
        console.log('Only T2 available, using T2 data');
        setStats(t2.stats);
        try {
          localStorage.setItem('last_output_filename', 'COLLECTES DECHETERIES T2 2025.xlsx');
        } catch (storageError) {
          // Ignore storage failures
        }
      } else {
        setError('Aucune statistique disponible. Importez les données brutes ou générez les fichiers de sortie.');
      }
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
  }, [outputFilename]);

  const datasetYear = stats?.dataset_year || inferYearFromFilename(outputFilename);

  return { stats, loading, error, loadStats, datasetYear };
};
