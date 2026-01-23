import React, { useMemo, useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Table, LineChart as LineChartIcon } from 'lucide-react';
import StatCard from '../StatCard';
import StatsTable from '../StatsTable';
import MonthlyLineChart from '../MonthlyLineChart';
import MultiLineChart from '../MultiLineChart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  buildCategoryColorMap,
  buildFinalFluxColorMap,
  buildRangeLabel,
  formatDuAuRange,
  formatKg,
  formatExactDate
} from '../../../utils/statistics';

const DechetterieDetail = ({ stats, dechetterieName, datasetYear }) => {
  const data = stats.dechetteries?.[dechetterieName];
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

  const timeSeries = useMemo(() => {
    return (stats.months_order || []).map((month) => {
      const monthData = data?.months?.[month] || {};
      const entry = { month };
      categories.forEach((cat) => {
        entry[cat] = monthData[cat] || 0;
      });
      entry.TOTAL = monthData.TOTAL || 0;
      return entry;
    });
  }, [stats.months_order, data, categories]);

  const monthlyTotals = useMemo(() => {
    return (stats.months_order || []).map((month) => ({
      month,
      total: data?.months?.[month]?.TOTAL || 0,
    }));
  }, [stats.months_order, data]);

  const finalMonthlyData = useMemo(() => {
    return (stats.months_order || []).map((month) => {
      const entry = { month };
      finalFluxes.forEach((flux) => {
        entry[flux] = data?.months?.[month]?.[flux] || 0;
      });
      return entry;
    });
  }, [stats.months_order, data, finalFluxes]);

  const totals = useMemo(() => data?.total || {}, [data]);
  const finalTotalsData = useMemo(
    () => finalFluxes.map((flux) => ({ name: flux, value: totals[flux] || 0 })),
    [finalFluxes, totals]
  );

  const categoryTotalsData = useMemo(
    () => categories.map((cat) => ({ name: cat, value: totals[cat] || 0 })),
    [categories, totals]
  );

  const [visible, setVisible] = useState(() => new Set(categories));

  useEffect(() => {
    setVisible(new Set(categories));
  }, [dechetterieName, categories]);

  const toggleCategory = (cat) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const top3 = useMemo(() => {
    return categories
      .map((cat) => ({ cat, value: totals[cat] || 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  }, [categories, totals]);

  if (!data) {
    return null;
  }

  const dateRange = stats.date_range || buildRangeLabel(stats.months_order || [], datasetYear);
  const formattedRange = formatDuAuRange(dateRange);

  return (
    <div className="space-y-6">
      {/* Vue d'ensemble - toujours visible */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total"
          value={`${formatKg(totals.TOTAL)} kg`}
          description="Somme de tous les flux"
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top flux</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {top3.map((entry) => (
              <div key={entry.cat} className="flex items-center justify-between text-sm">
                <span className="truncate">{entry.cat}</span>
                <span className="tabular-nums">{formatKg(entry.value)} kg</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <StatCard
          title="Flux visibles"
          value={`${visible.size}/${categories.length}`}
          description="Cliquer la légende pour filtrer"
        />
      </div>

      {/* Sections organisées avec accordéons */}
      <Accordion type="multiple" defaultValue={['curves']} className="w-full">
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
              <MultiLineChart
                title="Évolution mensuelle par flux"
                description={`Une ligne par flux · kg ${formattedRange}`}
                data={timeSeries}
                categories={categories}
                colorMap={colorMap}
                visible={visible}
                onToggle={toggleCategory}
                datasetYear={datasetYear}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <MonthlyLineChart
                  title="Total mensuel"
                  description={`Somme des flux (kg) ${formattedRange}`}
                  data={monthlyTotals}
                  datasetYear={datasetYear}
                  color="#8b5cf6"
                />

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Flux finaux</CardTitle>
                    <CardDescription className="text-xs">
                      Massicot · Démantèlement · Déchets ultimes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
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
            </div>
          </AccordionContent>
        </AccordionItem>

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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <StatsTable
                  title="Flux finaux (tableau)"
                  description="Unité affichée une seule fois"
                  data={finalTotalsData}
                  totalValue={finalTotalsData.reduce((sum, item) => sum + item.value, 0)}
                />

                <StatsTable
                  title="Totaux par flux"
                  description="Unité affichée une seule fois"
                  data={categoryTotalsData}
                  totalValue={totals.TOTAL || 0}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default DechetterieDetail;
