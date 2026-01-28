import React, { useMemo, useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Alert, AlertDescription } from '../../ui/alert';
import { Table, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getDumpCategoryStats } from '../../../services/api';
import OverviewCards from '../OverviewCards';
import StatsTable, { MultiColumnStatsTable } from '../StatsTable';
import MonthlyLineChart from '../MonthlyLineChart';
import MultiLineChart from '../MultiLineChart';
import FluxCalendarHeatmap from '../FluxCalendarHeatmap';
import AdvancedStatsPanel from '../AdvancedStatsPanel';
import DoubleDonutChart from '../DoubleDonutChart';
import {
  buildCategoryColorMap,
  buildFinalFluxColorMap,
  buildGlobalMonthlyData,
  buildRangeLabel,
  formatDuAuRange,
  formatKg,
  formatExactDate,
  smoothTimeSeries
} from '../../../utils/statistics';

const GlobalOverview = ({ stats, datasetYear, selectedYear }) => {
  const [categoryStats, setCategoryStats] = useState([]);
  const [loadingCategoryStats, setLoadingCategoryStats] = useState(true);

  useEffect(() => {
    const loadCategoryStats = async () => {
      try {
        setLoadingCategoryStats(true);
        const result = await getDumpCategoryStats(selectedYear || datasetYear || 2025);
        if (result?.success && result.data) {
          setCategoryStats(result.data);
        }
      } catch (error) {
        // Ignore errors
      } finally {
        setLoadingCategoryStats(false);
      }
    };
    loadCategoryStats();
  }, [selectedYear, datasetYear]);

  // Vérification de sécurité
  if (!stats || !stats.global_totals) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertDescription>
              Les statistiques ne sont pas disponibles ou sont dans un format incorrect.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const finalFluxes = useMemo(
    () => stats.final_fluxes || ['DECHETS ULTIMES'],
    [stats.final_fluxes]
  );
  // MASSICOT et DEMANTELEMENT sont maintenant dans category_columns, donc inclus dans les catégories
  // Seul DECHETS ULTIMES reste un flux final séparé
  const categories = useMemo(() => {
    const cols = stats.category_columns || [];
    return cols.filter((col) => !finalFluxes.includes(col));
  }, [stats.category_columns, finalFluxes]);
  const colorMap = useMemo(() => buildCategoryColorMap(categories), [categories]);
  const finalFluxColorMap = useMemo(() => buildFinalFluxColorMap(finalFluxes), [finalFluxes]);
  const [visible, setVisible] = useState(() => new Set(categories));

  useEffect(() => {
    setVisible(new Set(categories));
  }, [categories]);

  const categoryTotalsData = categories
    .map((col) => ({ name: col, value: stats.global_totals[col] || 0 }))
    .sort((a, b) => b.value - a.value);

  const finalTotalsData = finalFluxes.map((flux) => ({
    name: flux,
    value: stats.global_totals[flux] || 0,
  }));

  const monthlyData = buildGlobalMonthlyData(stats);
  const smoothedMonthlyData = useMemo(
    () => smoothTimeSeries(monthlyData, ['total'], 7),
    [monthlyData]
  );
  const monthsWithData = monthlyData.filter((item) => item.total > 0).map((item) => item.month);
  const datasetYearLabel = datasetYear || 'Année inconnue';
  const datasetRangeLabel = buildRangeLabel(monthsWithData, datasetYear);
  const explicitRangeLabel = stats.date_range || formatDuAuRange(datasetRangeLabel);

  const monthlyFluxData = useMemo(() => {
    const data = (stats.months_order || []).map((month) => {
      const entry = { month };
      categories.forEach((cat) => {
        let total = 0;
        Object.values(stats.dechetteries || {}).forEach((data) => {
          total += data.months?.[month]?.[cat] || 0;
        });
        entry[cat] = total;
      });
      return entry;
    });
    
    return data;
  }, [stats.months_order, stats.dechetteries, categories]);

  const smoothedMonthlyFluxData = useMemo(
    () => smoothTimeSeries(monthlyFluxData, categories, 7),
    [monthlyFluxData, categories]
  );

  const finalMonthlyData = useMemo(() => {
    const data = (stats.months_order || []).map((month) => {
      const entry = { month };
      finalFluxes.forEach((flux) => {
        let total = 0;
        Object.values(stats.dechetteries || {}).forEach((data) => {
          total += data.months?.[month]?.[flux] || 0;
        });
        entry[flux] = total;
      });
      return entry;
    });
    
    return data;
  }, [stats.months_order, stats.dechetteries, finalFluxes]);

  const smoothedFinalMonthlyData = useMemo(
    () => smoothTimeSeries(finalMonthlyData, finalFluxes, 7),
    [finalMonthlyData, finalFluxes]
  );

  const toggleCategory = (cat) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Préparer les données pour le tableau multi-colonnes
  const dechetterieDetailsData = Object.entries(stats.dechetteries).map(([name, data]) => {
    const row = { name };
    categories.forEach((col) => {
      row[col] = data.total?.[col] || 0;
    });
    row.TOTAL = data.total?.TOTAL || 0;
    return row;
  });

  const percentageData = Object.entries(stats.dechetteries).map(([name, data]) => {
    const row = { name };
    categories.forEach((col) => {
      row[col] = data.total?.[col] || 0;
    });
    row.TOTAL = data.total?.TOTAL || 0;
    return row;
  });

  return (
    <div className="space-y-6">
      {/* Vue d'ensemble - toujours visible */}
      <OverviewCards stats={stats} monthlyData={monthlyData} />

      {/* Sections organisées avec accordéons */}
      <Accordion type="multiple" defaultValue={['tables', 'charts']} className="w-full">

        {/* Section Tableaux */}
        <AccordionItem value="tables">
          <AccordionTrigger className="text-lg font-semibold">
            <div className="flex items-center gap-2">
              <Table className="h-5 w-5" />
              <span>Tableaux détaillés</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Totaux par flux</CardTitle>
                  <CardDescription className="text-xs">
                    Tableau global (kg) • Grand total inclut toutes les catégories + flux finaux • {datasetYearLabel}{explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Sous-tableau 1: Flux recyclage */}
                    <div>
                      <h4 className="text-sm font-semibold mb-2 text-green-700">Flux mis en valeur (recyclage)</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left px-2 py-1 text-[11px] font-semibold whitespace-nowrap">Flux</th>
                              <th className="text-right px-2 py-1 text-[11px] font-semibold whitespace-nowrap">Total (kg)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoryTotalsData.map((item) => (
                              <tr key={item.name} className="border-b">
                                <td className="px-2 py-1">{item.name}</td>
                                <td className="px-2 py-1 text-right">{formatKg(item.value)}</td>
                              </tr>
                            ))}
                            <tr className="border-t-2 font-bold">
                              <td className="px-2 py-1">Sous-total recyclage</td>
                              <td className="px-2 py-1 text-right">
                                {formatKg(categoryTotalsData.reduce((sum, item) => sum + (item.value || 0), 0))}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Sous-tableau 2: Flux finaux */}
                    <div>
                      <h4 className="text-sm font-semibold mb-2 text-orange-700">Flux finaux</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left px-2 py-1 text-[11px] font-semibold whitespace-nowrap">Flux</th>
                              <th className="text-right px-2 py-1 text-[11px] font-semibold whitespace-nowrap">Total (kg)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {finalTotalsData.map((item) => (
                              <tr key={item.name} className="border-b">
                                <td className="px-2 py-1">{item.name}</td>
                                <td className="px-2 py-1 text-right">{formatKg(item.value)}</td>
                              </tr>
                            ))}
                            <tr className="border-t-2 font-bold">
                              <td className="px-2 py-1">Sous-total flux finaux</td>
                              <td className="px-2 py-1 text-right">
                                {formatKg(finalTotalsData.reduce((sum, item) => sum + (item.value || 0), 0))}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Grand total */}
                    <div className="border-t-2 pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-bold">GRAND TOTAL</span>
                        <span className="text-base font-bold">{formatKg(stats.global_totals.TOTAL)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <MultiColumnStatsTable
                title="Détails par déchetterie"
                description={`Poids par flux (kg) • ${datasetYearLabel}${explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}`}
                data={dechetterieDetailsData}
                columns={categories}
                totals={stats.global_totals}
              />

              <MultiColumnStatsTable
                title="Répartition en pourcentage"
                description={`Répartition en % par flux • ${datasetYearLabel}${explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}`}
                data={percentageData}
                columns={categories}
                totals={stats.global_totals}
                isPercentage={true}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section Graphiques */}
        <AccordionItem value="charts">
          <AccordionTrigger className="text-lg font-semibold">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <span>Graphiques en barres</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              {!loadingCategoryStats && categoryStats.length > 0 && (
                <DoubleDonutChart
                  title="Répartition par catégorie et sous-catégorie"
                  description={`Flux par catégorie (extérieur) et sous-catégorie (intérieur) • ${datasetYearLabel}`}
                  data={categoryStats}
                  height={600}
                />
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section Courbes */}
        <AccordionItem value="curves">
          <AccordionTrigger className="text-lg font-semibold">
            <div className="flex items-center gap-2">
              <LineChartIcon className="h-5 w-5" />
              <span>Évolutions temporelles</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <MonthlyLineChart
                title="Évolution globale"
                description={`Total collecté par date (kg) • ${datasetYearLabel}${explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}`}
                data={smoothedMonthlyData}
                datasetYear={datasetYear}
              />

              <MultiLineChart
                title="Évolution par flux"
                description={`Toutes les déchetteries · kg • ${datasetYearLabel}${explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}`}
                data={smoothedMonthlyFluxData}
                categories={categories}
                colorMap={colorMap}
                visible={visible}
                onToggle={toggleCategory}
                datasetYear={datasetYear}
              />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Flux finaux</CardTitle>
                  <CardDescription className="text-xs">
                    Massicot · Démantèlement · Déchets ultimes • {datasetYearLabel}{explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={smoothedFinalMonthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value) => `${formatKg(value)} kg`}
                        labelFormatter={(label) => formatExactDate(label, datasetYear)}
                      />
                      <Legend wrapperStyle={{ paddingTop: 8 }} iconSize={10} />
                      {finalFluxes.map((flux) => (
                        <Line
                          key={flux}
                          type="monotoneX"
                          dataKey={flux}
                          stroke={finalFluxColorMap[flux] || '#3b82f6'}
                          strokeWidth={2}
                          dot={false}
                          name={flux}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section Heatmap */}
        <AccordionItem value="heatmap">
          <AccordionTrigger className="text-lg font-semibold">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <span>Heatmap des flux</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-6 pt-2">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {categories.map((cat) => (
                  <FluxCalendarHeatmap
                    key={cat}
                    title={cat}
                    description={`Poids journalier (kg) • ${datasetYearLabel}${explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}`}
                    series={Object.fromEntries(
                      (stats.months_order || []).map((date) => [
                        date,
                        Object.values(stats.dechetteries || {}).reduce(
                          (sum, d) => sum + (d.months?.[date]?.[cat] || 0),
                          0
                        )
                      ])
                    )}
                    dateRange={{ start: stats.date_start, end: stats.date_end }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {finalFluxes.map((flux) => (
                  <FluxCalendarHeatmap
                    key={flux}
                    title={flux}
                    description={`Poids journalier (kg) • ${datasetYearLabel}${explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}`}
                    series={Object.fromEntries(
                      (stats.months_order || []).map((date) => [
                        date,
                        Object.values(stats.dechetteries || {}).reduce(
                          (sum, d) => sum + (d.months?.[date]?.[flux] || 0),
                          0
                        )
                      ])
                    )}
                    dateRange={{ start: stats.date_start, end: stats.date_end }}
                  />
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section Statistiques avancées */}
        <AccordionItem value="advanced">
          <AccordionTrigger className="text-lg font-semibold">
            <div className="flex items-center gap-2">
              <LineChartIcon className="h-5 w-5" />
              <span>Statistiques avancées</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <AdvancedStatsPanel year={selectedYear || datasetYear} />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default GlobalOverview;
