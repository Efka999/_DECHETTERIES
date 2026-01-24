import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import {
  getAdvancedSeries,
  getAdvancedCategory,
  getAdvancedFluxOrientation,
  getAdvancedAnomalies,
  getAdvancedMissingDays,
  getAdvancedComparison
} from '../../services/api';
import MonthlyLineChart from './MonthlyLineChart';
import { formatKg, formatExactDate } from '../../utils/statistics';

const AdvancedStatsPanel = () => {
  const [granularity, setGranularity] = useState('day');
  const [series, setSeries] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [fluxMatrix, setFluxMatrix] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [missingDays, setMissingDays] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [seriesRes, catRes, fluxRes, anomaliesRes, missingRes, compRes] = await Promise.all([
        getAdvancedSeries(granularity),
        getAdvancedCategory(),
        getAdvancedFluxOrientation(),
        getAdvancedAnomalies(10),
        getAdvancedMissingDays(),
        getAdvancedComparison()
      ]);
      setSeries(seriesRes.data || []);
      setCategoryStats(catRes.data || []);
      setFluxMatrix(fluxRes.data || []);
      setAnomalies(anomaliesRes.data || []);
      setMissingDays(missingRes.data || []);
      setComparison(compRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity]);

  const globalSeries = useMemo(() => {
    const grouped = new Map();
    series.forEach((row) => {
      const key = row.period;
      const current = grouped.get(key) || 0;
      grouped.set(key, current + Number(row.total || 0));
    });
    return Array.from(grouped.entries()).map(([period, total]) => ({
      month: period,
      total
    }));
  }, [series]);

  const topCategories = useMemo(() => categoryStats.slice(0, 20), [categoryStats]);

  const fluxRows = useMemo(() => {
    const rows = {};
    fluxMatrix.forEach((row) => {
      if (!rows[row.flux]) rows[row.flux] = { flux: row.flux };
      rows[row.flux][row.orientation] = row.total;
    });
    return Object.values(rows);
  }, [fluxMatrix]);

  const fluxColumns = useMemo(() => {
    const set = new Set();
    fluxMatrix.forEach((row) => set.add(row.orientation));
    return Array.from(set);
  }, [fluxMatrix]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Granularité:</span>
        {['day', 'week', 'month'].map((value) => (
          <Button
            key={value}
            size="sm"
            variant={granularity === value ? 'default' : 'outline'}
            onClick={() => setGranularity(value)}
          >
            {value === 'day' ? 'Jour' : value === 'week' ? 'Semaine' : 'Mois'}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Chargement des statistiques avancées...
        </div>
      ) : (
        <div className="space-y-4">
          <MonthlyLineChart
            title="Série temporelle globale"
            description={`Agrégation ${granularity}`}
            data={globalSeries}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Catégories & sous-catégories (Top 20)</CardTitle>
              <CardDescription className="text-xs">Poids cumulés (kg)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-auto rounded-md border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-left">Catégorie</th>
                      <th className="px-3 py-2 text-left">Sous catégorie</th>
                      <th className="px-3 py-2 text-right">Total (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCategories.map((row, idx) => (
                      <tr key={`${row.categorie}-${row.sous_categorie}-${idx}`} className="border-t">
                        <td className="px-3 py-2">{row.categorie}</td>
                        <td className="px-3 py-2">{row.sous_categorie || '-'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatKg(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Flux × Orientation</CardTitle>
              <CardDescription className="text-xs">Matrice de poids (kg)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-auto rounded-md border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-left">Flux</th>
                      {fluxColumns.map((col) => (
                        <th key={col} className="px-3 py-2 text-right">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fluxRows.map((row) => (
                      <tr key={row.flux} className="border-t">
                        <td className="px-3 py-2">{row.flux}</td>
                        {fluxColumns.map((col) => (
                          <td key={col} className="px-3 py-2 text-right tabular-nums">
                            {formatKg(row[col] || 0)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Anomalies (pics)</CardTitle>
              <CardDescription className="text-xs">Top 10 jours les plus élevés</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {anomalies.map((row, idx) => (
                  <div key={`${row.date}-${row.dechetterie}-${idx}`} className="flex justify-between text-sm">
                    <span>{formatExactDate(row.date)} · {row.dechetterie} · {row.flux}</span>
                    <span className="tabular-nums">{formatKg(row.total)} kg</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Jours manquants</CardTitle>
              <CardDescription className="text-xs">Nombre de jours sans collecte</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {missingDays.map((row) => (
                  <div key={row.dechetterie} className="flex justify-between text-sm">
                    <span>{row.dechetterie}</span>
                    <span className="tabular-nums">{row.missing_days.length}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparaison des déchetteries</CardTitle>
              <CardDescription className="text-xs">Classement + écart vs moyenne</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {comparison.map((row) => (
                  <div key={row.dechetterie} className="flex justify-between text-sm">
                    <span>{row.dechetterie}</span>
                    <span className="tabular-nums">
                      {formatKg(row.total)} kg (Δ {formatKg(row.delta_vs_avg)} kg)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdvancedStatsPanel;
