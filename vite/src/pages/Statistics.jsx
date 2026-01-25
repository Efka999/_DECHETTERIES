import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GlobalHeader from '../components/GlobalHeader';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { ArrowLeft, Loader2 } from 'lucide-react';
import SidebarNavigation from '../components/Sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../components/ui/sidebar';
import { useStatistics } from '../hooks/useStatistics';
import { getAvailableYears, getDbStatus } from '../services/api';
import GlobalOverview from '../components/statistics/sections/GlobalOverview';
import DechetterieDetail from '../components/statistics/sections/DechetterieDetail';
import { normalizeName } from '../utils/statistics';

const Statistics = ({ outputFilename, onBack }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [persistedFilename, setPersistedFilename] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  
  useEffect(() => {
    try {
      const stored = localStorage.getItem('last_output_filename');
      if (stored) {
        setPersistedFilename(stored);
      }
    } catch (storageError) {
      // Ignore storage failures
    }
  }, []);

  useEffect(() => {
    const loadYears = async () => {
      try {
        const result = await getAvailableYears();
        if (result?.success) {
          const years = result.years || [];
          setAvailableYears(years);

          if (!selectedYear) {
            const currentYear = new Date().getFullYear();
            const latest = result.latest || (years.length > 0 ? years[years.length - 1] : null);
            let nextYear = latest || currentYear;

            if (years.includes(currentYear)) {
              try {
                const status = await getDbStatus(currentYear);
                if (!status?.success || !status?.rows) {
                  nextYear = currentYear - 1;
                } else {
                  nextYear = currentYear;
                }
              } catch (err) {
                nextYear = currentYear - 1;
              }
            }

            setSelectedYear(nextYear);
          }
        }
      } catch (err) {
        // Ignore year loading errors
      }
    };
    loadYears();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveOutputFilename = outputFilename || location.state?.outputFilename || persistedFilename;
  const handleBack = onBack || (() => navigate('/'));
  const { stats, loading, error, datasetYear } = useStatistics(effectiveOutputFilename, selectedYear);
  const [selectedKey, setSelectedKey] = useState('global');

  useEffect(() => {
    if (!stats || selectedKey === 'global') return;
    if (!stats.dechetteries?.[selectedKey]) {
      setSelectedKey('global');
    }
  }, [stats, selectedKey]);

  const availableDechetteries = useMemo(
    () => Object.keys(stats?.dechetteries || {}),
    [stats]
  );

  const selectedDechetterie = selectedKey === 'global' ? null : selectedKey;
  
  const resolveSelection = (key) => {
    if (key === 'global') return 'global';
    const match = availableDechetteries.find(
      (name) => normalizeName(name) === normalizeName(key)
    );
    return match || key;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <GlobalHeader />
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <Card>
            <CardContent className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#5ea226]" />
              <span className="ml-3 text-lg text-foreground">Chargement des statistiques...</span>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!stats && !error) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader />
      <SidebarProvider>
        <SidebarNavigation
          selectedKey={selectedKey}
          onSelect={(key) => setSelectedKey(resolveSelection(key))}
          availableDechetteries={availableDechetteries}
        />
        <SidebarInset className="p-3 md:p-4">
          <div className="w-full max-w-none space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold">Statistiques des Collectes</h1>
                <p className="text-muted-foreground">Gestion des recycleries · analyses par déchetterie</p>
              </div>
              <div className="flex items-center gap-2">
                {availableYears.length > 0 && (
                  <select
                    value={selectedYear || ''}
                    onChange={(event) => setSelectedYear(Number(event.target.value))}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                )}
                <SidebarTrigger />
                <Button onClick={handleBack} variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour
                </Button>
              </div>
            </div>

            {error ? (
              <Card>
                <CardContent className="py-8">
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            ) : selectedDechetterie ? (
              <DechetterieDetail
                stats={stats}
                dechetterieName={selectedDechetterie}
                datasetYear={datasetYear}
              />
            ) : (
              <GlobalOverview stats={stats} datasetYear={datasetYear} selectedYear={selectedYear} />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default Statistics;
