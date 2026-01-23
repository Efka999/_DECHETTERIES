import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GlobalHeader from '../components/GlobalHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getStats } from '../services/api';
import SidebarNavigation from '../components/Sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../components/ui/sidebar';
import { ArrowLeft, Loader2, TrendingUp, Package, MapPin, BarChart3, Table, LineChart as LineChartIcon } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#84cc16'];

const MONTH_INFO = {
  JANVIER: { label: 'Janvier', index: 0 },
  FEVRIER: { label: 'Fevrier', index: 1 },
  MARS: { label: 'Mars', index: 2 },
  AVRIL: { label: 'Avril', index: 3 },
  MAI: { label: 'Mai', index: 4 },
  JUIN: { label: 'Juin', index: 5 },
  JUILLET: { label: 'Juillet', index: 6 },
  AOUT: { label: 'Aout', index: 7 },
  SEPTEMBRE: { label: 'Septembre', index: 8 },
  OCTOBRE: { label: 'Octobre', index: 9 },
  NOVEMBRE: { label: 'Novembre', index: 10 },
  DECEMBRE: { label: 'Decembre', index: 11 },
};

const formatKg = (value) => Math.round(Number(value || 0)).toLocaleString('fr-FR');
const formatPercent = (value) => {
  const n = Number(value || 0);
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
};

const normalizeMonthKey = (value) =>
  String(value || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getMonthInfo = (value) => MONTH_INFO[normalizeMonthKey(value)];

const formatMonthYear = (value, year) => {
  const info = getMonthInfo(value);
  if (!info) return String(value || '');
  return year ? `${info.label} ${year}` : info.label;
};

const formatExactDate = (value, year) => {
  const info = getMonthInfo(value);
  if (!info) return String(value || '');
  if (!year) return info.label;
  return `01 ${info.label} ${year}`;
};

const inferYearFromFilename = (filename) => {
  const match = String(filename || '').match(/(19|20)\d{2}/);
  return match ? match[0] : null;
};

const buildRangeLabel = (months, year) => {
  if (!months || months.length === 0) {
    return year ? `${year}` : '';
  }
  const sorted = [...months].sort((a, b) => {
    const aIndex = getMonthInfo(a)?.index ?? 999;
    const bIndex = getMonthInfo(b)?.index ?? 999;
    return aIndex - bIndex;
  });
  const start = sorted[0];
  const end = sorted[sorted.length - 1];
  if (start === end) {
    return formatMonthYear(start, year);
  }
  return `${formatMonthYear(start, year)} → ${formatMonthYear(end, year)}`;
};

const formatDuAuRange = (label) => {
  if (!label) return '';
  if (label.toUpperCase().startsWith('DU ')) return label;
  const parts = label.split('→').map((item) => item.trim()).filter(Boolean);
  if (parts.length === 2) {
    return `DU ${parts[0]} AU ${parts[1]}`;
  }
  return `DU ${label}`;
};

const normalizeName = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\s-]+/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const buildCategoryColorMap = (categories) => {
  const map = {};
  (categories || []).forEach((cat, idx) => {
    map[cat] = COLORS[idx % COLORS.length];
  });
  return map;
};

const buildFinalFluxColorMap = (finalFluxes) => {
  // Couleurs spécifiques pour les flux finaux
  const finalFluxColors = {
    'MASSICOT': '#ef4444',      // Rouge
    'DEMANTELEMENT': '#f59e0b', // Orange
    'DECHETS ULTIMES': '#6b7280' // Gris foncé
  };
  
  const map = {};
  (finalFluxes || []).forEach((flux) => {
    map[flux] = finalFluxColors[flux] || COLORS[Math.floor(Math.random() * COLORS.length)];
  });
  return map;
};

const buildGlobalMonthlyData = (stats) => {
  return (stats.months_order || []).map((month) => {
    let total = 0;
    Object.values(stats.dechetteries || {}).forEach((data) => {
      total += data.months?.[month]?.TOTAL || 0;
    });
    return { month, total };
  });
};

const combineStats = (t1Stats, t2Stats) => {
  if (!t1Stats && !t2Stats) return null;
  if (!t1Stats) return t2Stats;
  if (!t2Stats) return t1Stats;

  console.log('Combining T1 and T2 stats...');
  console.log('T1 dechetteries:', Object.keys(t1Stats.dechetteries || {}));
  console.log('T2 dechetteries:', Object.keys(t2Stats.dechetteries || {}));
  console.log('T1 months:', t1Stats.months_order);
  console.log('T2 months:', t2Stats.months_order);

  // Combine dechetteries data - start with T1 data
  const combinedDechetteries = {};
  
  // First, add all T1 déchetteries with deep copy
  Object.entries(t1Stats.dechetteries || {}).forEach(([name, t1Data]) => {
    // Deep copy months data
    const monthsCopy = {};
    Object.entries(t1Data.months || {}).forEach(([month, monthData]) => {
      monthsCopy[month] = { ...monthData };
    });
    
    combinedDechetteries[name] = {
      months: monthsCopy,
      total: { ...t1Data.total },
      categories: { ...(t1Data.categories || {}) }
    };
  });
  
  // Then, merge T2 déchetteries
  Object.entries(t2Stats.dechetteries || {}).forEach(([name, t2Data]) => {
    if (combinedDechetteries[name]) {
      // Merge existing déchetterie
      const t1Data = combinedDechetteries[name];
      
      // Merge months data - T1 months are already there, add T2 months
      // Deep copy T1 months first - ensure all T1 months are preserved
      const combinedMonths = {};
      Object.entries(t1Data.months || {}).forEach(([month, monthData]) => {
        // Deep copy to ensure no reference issues
        combinedMonths[month] = {};
        Object.keys(monthData).forEach((key) => {
          combinedMonths[month][key] = monthData[key];
        });
      });
      
      // Then add/merge T2 months
      Object.entries(t2Data.months || {}).forEach(([month, monthData]) => {
        if (combinedMonths[month]) {
          // Merge month data - add values (shouldn't happen if T1=6mois and T2=6mois, but handle it)
          const existing = combinedMonths[month];
          Object.keys(monthData).forEach((key) => {
            if (key !== 'month') {
              existing[key] = (existing[key] || 0) + (monthData[key] || 0);
            }
          });
        } else {
          // New month from T2 (this should be the case for juillet-décembre)
          // Deep copy monthData to avoid reference issues
          combinedMonths[month] = {};
          Object.keys(monthData).forEach((key) => {
            combinedMonths[month][key] = monthData[key];
          });
        }
      });
      
      // Recalculate totals from combined months
      const categoryColumns = t1Stats.category_columns || t2Stats.category_columns || [];
      const combinedTotal = {};
      let grandTotal = 0;
      
      // Calculate totals for each category column
      categoryColumns.forEach((col) => {
        let colTotal = 0;
        Object.values(combinedMonths).forEach((monthData) => {
          colTotal += monthData[col] || 0;
        });
        combinedTotal[col] = colTotal;
        grandTotal += colTotal;
      });
      
      // Add DECHETS ULTIMES (separate from category columns)
      let ultimesTotal = 0;
      Object.values(combinedMonths).forEach((monthData) => {
        ultimesTotal += monthData['DECHETS ULTIMES'] || 0;
      });
      combinedTotal['DECHETS ULTIMES'] = ultimesTotal;
      // TOTAL includes all categories but not DECHETS ULTIMES (as per Excel structure)
      combinedTotal['TOTAL'] = grandTotal;
      
      combinedDechetteries[name] = {
        months: combinedMonths,
        total: combinedTotal,
        categories: t1Data.categories || {}
      };
      
      // Debug: verify T1 months are preserved
      const t1MonthKeys = Object.keys(t1Data.months || {});
      const t2MonthKeys = Object.keys(t2Data.months || {});
      const combinedMonthKeys = Object.keys(combinedMonths);
      
      console.log(`Merged ${name}:`, {
        t1Months: t1MonthKeys,
        t2Months: t2MonthKeys,
        combinedMonths: combinedMonthKeys,
        t1SampleMonth: t1MonthKeys[0] ? 
          { month: t1MonthKeys[0], data: t1Data.months[t1MonthKeys[0]] } : null,
        t2SampleMonth: t2MonthKeys[0] ? 
          { month: t2MonthKeys[0], data: t2Data.months[t2MonthKeys[0]] } : null,
        combinedSampleMonth: combinedMonthKeys[0] ? 
          { month: combinedMonthKeys[0], data: combinedMonths[combinedMonthKeys[0]] } : null,
        // Check if T1 months (JANVIER-JUIN) are in combined
        t1MonthsInCombined: t1MonthKeys.filter(m => combinedMonthKeys.includes(m)),
        // Check if T2 months (JUILLET-DECEMBRE) are in combined
        t2MonthsInCombined: t2MonthKeys.filter(m => combinedMonthKeys.includes(m))
      });
    } else {
      // New déchetterie from T2 - deep copy
      const monthsCopy = {};
      Object.entries(t2Data.months || {}).forEach(([month, monthData]) => {
        monthsCopy[month] = { ...monthData };
      });
      
      combinedDechetteries[name] = {
        months: monthsCopy,
        total: { ...t2Data.total },
        categories: { ...(t2Data.categories || {}) }
      };
    }
  });

  // Calculate global totals
  const categoryColumns = t1Stats.category_columns || t2Stats.category_columns || [];
  const globalTotals = {};
  categoryColumns.forEach((col) => {
    globalTotals[col] = 0;
    Object.values(combinedDechetteries).forEach((data) => {
      globalTotals[col] += data.total?.[col] || 0;
    });
  });
  
  let globalGrandTotal = 0;
  Object.values(combinedDechetteries).forEach((data) => {
    globalGrandTotal += data.total?.TOTAL || 0;
  });
  globalTotals['TOTAL'] = globalGrandTotal;
  
  let globalUltimes = 0;
  Object.values(combinedDechetteries).forEach((data) => {
    globalUltimes += data.total?.['DECHETS ULTIMES'] || 0;
  });
  globalTotals['DECHETS ULTIMES'] = globalUltimes;

  // Combine date ranges
  const dateStart = t1Stats.date_start || t2Stats.date_start;
  const dateEnd = t2Stats.date_end || t1Stats.date_end;
  const dateRange = t1Stats.date_range || t2Stats.date_range;
  
  // Determine dataset year
  let datasetYear = t1Stats.dataset_year || t2Stats.dataset_year;
  if (!datasetYear && dateStart) {
    const year = new Date(dateStart).getFullYear();
    datasetYear = String(year);
  }

  // Combine months_order to include all months from both T1 and T2
  // Always use the full year months order to ensure all months are displayed
  const allMonths = [
    'JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
    'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE'
  ];
  
  // Use the full year months order to ensure all months appear in graphs
  const combinedMonthsOrder = allMonths;

  return {
    dechetteries: combinedDechetteries,
    global_totals: globalTotals,
    category_columns: categoryColumns,
    final_fluxes: t1Stats.final_fluxes || t2Stats.final_fluxes || ['MASSICOT', 'DEMANTELEMENT', 'DECHETS ULTIMES'],
    months_order: combinedMonthsOrder.length > 0 ? combinedMonthsOrder : allMonths,
    num_dechetteries: Object.keys(combinedDechetteries).length,
    num_months: combinedMonthsOrder.length > 0 ? combinedMonthsOrder.length : allMonths.length,
    dataset_year: datasetYear,
    date_start: dateStart,
    date_end: dateEnd,
    date_range: dateRange
  };
};

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
    
    // Debug: log first few months to verify T1 data is present
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
    
    // Debug: log first few months to verify T1 data is present
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

  return (
    <div className="space-y-6">
      {/* Vue d'ensemble - toujours visible */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total général</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKg(stats.global_totals.TOTAL)} kg</div>
            <p className="text-xs text-muted-foreground">Toutes déchetteries confondues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Déchetteries</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.num_dechetteries}</div>
            <p className="text-xs text-muted-foreground">Déchetteries actives</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Période</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyData.length}</div>
            <p className="text-xs text-muted-foreground">Mois avec données</p>
          </CardContent>
        </Card>
      </div>

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
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Totaux par flux</CardTitle>
                    <CardDescription className="text-xs">
                      Tableau global (kg) • {datasetYearLabel}{explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
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
                            <td className="px-2 py-1">TOTAL</td>
                            <td className="px-2 py-1 text-right">{formatKg(stats.global_totals.TOTAL)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Flux finaux (tableau)</CardTitle>
                    <CardDescription className="text-xs">
                      Totaux globaux · kg • {datasetYearLabel}{explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left px-2 py-1 text-[11px] font-semibold whitespace-nowrap">Flux final</th>
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
                            <td className="px-2 py-1">TOTAL</td>
                            <td className="px-2 py-1 text-right">{formatKg(finalTotalsData.reduce((sum, item) => sum + item.value, 0))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Détails par déchetterie</CardTitle>
                  <CardDescription className="text-xs">
                    Poids par flux (kg) • {datasetYearLabel}{explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left px-2 py-1 text-[11px] font-semibold whitespace-nowrap">Déchetterie</th>
                          {categories.map((col) => (
                            <th key={col} className="text-right px-2 py-1 text-[11px] font-semibold whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                          <th className="text-right px-2 py-1 text-[11px] font-bold whitespace-nowrap">TOTAL (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(stats.dechetteries).map(([name, data]) => (
                          <tr key={name} className="border-b">
                            <td className="px-2 py-1 font-medium whitespace-nowrap">{name}</td>
                            {categories.map((col) => (
                              <td key={col} className="px-2 py-1 text-right">
                                {formatKg(data.total?.[col] || 0)}
                              </td>
                            ))}
                            <td className="px-2 py-1 text-right font-bold">{formatKg(data.total?.TOTAL || 0)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 font-bold">
                          <td className="px-2 py-1">TOTAL</td>
                          {categories.map((col) => (
                            <td key={col} className="px-2 py-1 text-right">
                              {formatKg(stats.global_totals[col] || 0)}
                            </td>
                          ))}
                          <td className="px-2 py-1 text-right">{formatKg(stats.global_totals.TOTAL || 0)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Répartition en pourcentage</CardTitle>
                  <CardDescription className="text-xs">
                    Répartition en % par flux • {datasetYearLabel}{explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left px-2 py-1 text-[11px] font-semibold whitespace-nowrap">Déchetterie</th>
                          {categories.map((col) => (
                            <th key={col} className="text-right px-2 py-1 text-[11px] font-semibold whitespace-nowrap">
                              {col} (%)
                            </th>
                          ))}
                          <th className="text-right px-2 py-1 text-[11px] font-bold whitespace-nowrap">TOTAL (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(stats.dechetteries).map(([name, data]) => (
                          <tr key={name} className="border-b">
                            <td className="px-2 py-1 font-medium whitespace-nowrap">{name}</td>
                            {categories.map((col) => {
                              const denom = stats.global_totals[col] || 0;
                              const value = denom ? (data.total?.[col] || 0) / denom * 100 : 0;
                              return (
                                <td key={col} className="px-2 py-1 text-right">
                                  {formatPercent(value)}
                                </td>
                              );
                            })}
                            <td className="px-2 py-1 text-right font-bold">
                              {formatPercent(
                                stats.global_totals.TOTAL
                                  ? (data.total?.TOTAL || 0) / stats.global_totals.TOTAL * 100
                                  : 0
                              )}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 font-bold">
                          <td className="px-2 py-1">TOTAL</td>
                          {categories.map((col) => (
                            <td key={col} className="px-2 py-1 text-right">
                              {formatPercent(100)}
                            </td>
                          ))}
                          <td className="px-2 py-1 text-right">{formatPercent(100)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
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
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Totaux par flux</CardTitle>
                    <CardDescription className="text-xs">Toutes déchetteries (kg)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={categoryTotalsData} layout="vertical" margin={{ left: 8, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} interval={0} />
                        <Tooltip formatter={(value) => `${formatKg(value)} kg`} labelFormatter={(label) => `Flux: ${label}`} />
                        <Bar dataKey="value" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Totaux par déchetterie</CardTitle>
                    <CardDescription className="text-xs">Comparaison globale (kg)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={dechetterieTotals} margin={{ bottom: 60, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} tick={{ fontSize: 10 }} interval={0} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => `${formatKg(value)} kg`} labelFormatter={(label) => `Déchetterie: ${label}`} />
                        <Bar dataKey="total" fill="#8b5cf6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Évolution mensuelle globale</CardTitle>
                  <CardDescription className="text-xs">
                    Total collecté par mois (kg) • {datasetYearLabel}{explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value) => `${formatKg(value)} kg`}
                        labelFormatter={(label) => formatExactDate(label, datasetYear)}
                      />
                      <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} name="Total" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Évolution mensuelle par flux</CardTitle>
                  <CardDescription className="text-xs">
                    Toutes les déchetteries · kg • {datasetYearLabel}{explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={monthlyFluxData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value) => `${formatKg(value)} kg`}
                        labelFormatter={(label) => formatExactDate(label, datasetYear)}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: 8 }}
                        iconSize={10}
                        onClick={(event) => {
                          const cat = event?.dataKey;
                          if (typeof cat === 'string') toggleCategory(cat);
                        }}
                      />
                      {categories.map((cat) => (
                        <Line
                          key={cat}
                          type="monotone"
                          dataKey={cat}
                          stroke={colorMap[cat] || '#3b82f6'}
                          strokeWidth={2}
                          dot={false}
                          hide={!visible.has(cat)}
                          name={cat}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

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

  return (
    <div className="space-y-6">
      {/* Vue d'ensemble - toujours visible */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatKg(totals.TOTAL)} kg</div>
            <p className="text-xs text-muted-foreground">Somme de tous les flux</p>
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Flux visibles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{visible.size}/{categories.length}</div>
            <p className="text-xs text-muted-foreground">Cliquer la légende pour filtrer</p>
          </CardContent>
        </Card>
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Évolution mensuelle par flux</CardTitle>
                  <CardDescription className="text-xs">
                    Une ligne par flux · kg {formatDuAuRange(stats.date_range || buildRangeLabel(stats.months_order || [], datasetYear))}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value) => `${formatKg(value)} kg`}
                        labelFormatter={(label) => formatExactDate(label, datasetYear)}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: 8 }}
                        iconSize={10}
                        onClick={(event) => {
                          const cat = event?.dataKey;
                          if (typeof cat === 'string') toggleCategory(cat);
                        }}
                      />
                      {categories.map((cat) => (
                        <Line
                          key={cat}
                          type="monotone"
                          dataKey={cat}
                          stroke={colorMap[cat] || '#3b82f6'}
                          strokeWidth={2}
                          dot={false}
                          hide={!visible.has(cat)}
                          name={cat}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Total mensuel</CardTitle>
                    <CardDescription className="text-xs">
                      Somme des flux (kg) {formatDuAuRange(stats.date_range || buildRangeLabel(stats.months_order || [], datasetYear))}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={monthlyTotals}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(value) => `${formatKg(value)} kg`}
                          labelFormatter={(label) => formatExactDate(label, datasetYear)}
                        />
                        <Line type="monotone" dataKey="total" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Total" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

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
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Flux finaux (tableau)</CardTitle>
                    <CardDescription className="text-xs">Unité affichée une seule fois</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left px-2 py-1 text-[11px] font-semibold whitespace-nowrap">Flux final</th>
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
                            <td className="px-2 py-1">TOTAL</td>
                            <td className="px-2 py-1 text-right">{formatKg(finalTotalsData.reduce((sum, item) => sum + item.value, 0))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Totaux par flux</CardTitle>
                    <CardDescription className="text-xs">Unité affichée une seule fois</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left px-2 py-1 text-[11px] font-semibold whitespace-nowrap">Flux</th>
                            <th className="text-right px-2 py-1 text-[11px] font-semibold whitespace-nowrap">Total (kg)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categories.map((cat) => (
                            <tr key={cat} className="border-b">
                              <td className="px-2 py-1">{cat}</td>
                              <td className="px-2 py-1 text-right">{formatKg(totals[cat] || 0)}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 font-bold">
                            <td className="px-2 py-1">TOTAL</td>
                            <td className="px-2 py-1 text-right">{formatKg(totals.TOTAL || 0)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

const Statistics = ({ outputFilename, onBack }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [persistedFilename, setPersistedFilename] = useState(null);
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
  const effectiveOutputFilename = outputFilename || location.state?.outputFilename || persistedFilename;
  const handleBack = onBack || (() => navigate('/'));
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedKey, setSelectedKey] = useState('global');
  const datasetYear = stats?.dataset_year || inferYearFromFilename(effectiveOutputFilename);

  useEffect(() => {
    // Always try to load stats, even if no filename is provided
    // This will attempt to load the annual file by default
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOutputFilename]);

  useEffect(() => {
    if (!stats || selectedKey === 'global') return;
    if (!stats.dechetteries?.[selectedKey]) {
      setSelectedKey('global');
    }
  }, [stats, selectedKey]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      // If provided filename, try that first
      if (effectiveOutputFilename) {
        const filename = effectiveOutputFilename.includes('/')
          ? effectiveOutputFilename.split('/').pop()
          : effectiveOutputFilename;
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
        setError('Aucun fichier de statistiques trouvé (T1 ou T2). Veuillez générer les fichiers de sortie d\'abord.');
      }
    } catch (err) {
      console.error('Error loading stats:', err);
      setError(err.message || 'Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

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

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <GlobalHeader />
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <Card>
            <CardContent className="py-8">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button onClick={handleBack} className="mt-4" variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!stats) {
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
                <SidebarTrigger />
                <Button onClick={handleBack} variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour
                </Button>
              </div>
            </div>

            {selectedDechetterie ? (
              <DechetterieDetail
                stats={stats}
                dechetterieName={selectedDechetterie}
                datasetYear={datasetYear}
              />
            ) : (
              <GlobalOverview stats={stats} datasetYear={datasetYear} />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default Statistics;
