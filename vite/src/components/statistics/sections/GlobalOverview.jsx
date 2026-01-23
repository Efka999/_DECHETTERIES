import React, { useMemo, useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Table, BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import OverviewCards from '../OverviewCards';
import StatsTable, { MultiColumnStatsTable } from '../StatsTable';
import CategoryBarChart from '../CategoryBarChart';
import DechetterieBarChart from '../DechetterieBarChart';
import MonthlyLineChart from '../MonthlyLineChart';
import MultiLineChart from '../MultiLineChart';
import {
  buildCategoryColorMap,
  buildFinalFluxColorMap,
  buildGlobalMonthlyData,
  buildRangeLabel,
  formatDuAuRange,
  formatKg,
  formatExactDate
} from '../../../utils/statistics';

const GlobalOverview = ({ stats, datasetYear }) => {
  const finalFluxes = useMemo(
    () => stats.final_fluxes || ['MASSICOT', 'DEMANTELEMENT', 'DECHETS ULTIMES'],
    [stats.final_fluxes]
  );
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

  const dechetterieTotals = Object.entries(stats.dechetteries)
    .map(([name, data]) => ({
      name: name.length > 12 ? `${name.slice(0, 12)}…` : name,
      fullName: name,
      total: data.total?.TOTAL || 0,
    }))
    .sort((a, b) => b.total - a.total);

  const monthlyData = buildGlobalMonthlyData(stats);
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
    
    console.log('monthlyFluxData sample (first 3 months):', data.slice(0, 3));
    console.log('Sample dechetterie months data:', stats.dechetteries ? 
      Object.keys(stats.dechetteries)[0] ? 
        Object.entries(stats.dechetteries[Object.keys(stats.dechetteries)[0]].months || {}).slice(0, 6) : 
        null : 
      null
    );
    
    return data;
  }, [stats.months_order, stats.dechetteries, categories]);

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
    
    console.log('finalMonthlyData sample (first 3 months):', data.slice(0, 3));
    
    return data;
  }, [stats.months_order, stats.dechetteries, finalFluxes]);

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
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <StatsTable
                  title="Totaux par flux"
                  description={`Tableau global (kg) • ${datasetYearLabel}${explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}`}
                  data={categoryTotalsData}
                  totalValue={stats.global_totals.TOTAL}
                />

                <StatsTable
                  title="Flux finaux (tableau)"
                  description={`Totaux globaux · kg • ${datasetYearLabel}${explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}`}
                  data={finalTotalsData}
                  totalValue={finalTotalsData.reduce((sum, item) => sum + item.value, 0)}
                />
              </div>

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
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <CategoryBarChart
                  title="Totaux par flux"
                  description="Toutes déchetteries (kg)"
                  data={categoryTotalsData}
                />

                <DechetterieBarChart
                  title="Totaux par déchetterie"
                  description="Comparaison globale (kg)"
                  data={dechetterieTotals}
                />
              </div>
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
                title="Évolution mensuelle globale"
                description={`Total collecté par mois (kg) • ${datasetYearLabel}${explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}`}
                data={monthlyData}
                datasetYear={datasetYear}
              />

              <MultiLineChart
                title="Évolution mensuelle par flux"
                description={`Toutes les déchetteries · kg • ${datasetYearLabel}${explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}`}
                data={monthlyFluxData}
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
                    <LineChart data={finalMonthlyData}>
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
                          type="monotone"
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
      </Accordion>
    </div>
  );
};

export default GlobalOverview;
