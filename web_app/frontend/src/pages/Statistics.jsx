import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GlobalHeader from '../components/GlobalHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getStats } from '../services/api';
import SidebarNavigation from '../components/Sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../components/ui/sidebar';
import { ArrowLeft, Loader2, TrendingUp, Package, MapPin } from 'lucide-react';

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

const buildGlobalMonthlyData = (stats) => {
  return (stats.months_order || []).map((month) => {
    let total = 0;
    Object.values(stats.dechetteries || {}).forEach((data) => {
      total += data.months?.[month]?.TOTAL || 0;
    });
    return { month, total };
  });
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
    return (stats.months_order || []).map((month) => {
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
  }, [stats.months_order, stats.dechetteries, categories]);

  const finalMonthlyData = useMemo(() => {
    return (stats.months_order || []).map((month) => {
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
          <CardTitle className="text-base">Détails par déchetterie</CardTitle>
          <CardDescription className="text-xs">
            Repartition en % par flux • {datasetYearLabel}{explicitRangeLabel ? ` • ${explicitRangeLabel}` : ''}
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
                  stroke={colorMap[flux] || '#3b82f6'}
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
                    stroke={colorMap[flux] || '#3b82f6'}
                    strokeWidth={2}
                    dot={false}
                    name={flux}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

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
    if (effectiveOutputFilename) {
      loadStats();
    } else {
      setLoading(false);
      setError('Aucun fichier de sortie disponible pour afficher les statistiques.');
    }
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
      const filename = effectiveOutputFilename.includes('/')
        ? effectiveOutputFilename.split('/').pop()
        : effectiveOutputFilename;
      const result = await getStats(filename);
      if (result.success) {
        setStats(result.stats);
      } else {
        setError(result.message || 'Erreur lors du chargement des statistiques');
      }
    } catch (err) {
      setError(err.message);
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
      <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-lg">Chargement des statistiques...</span>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
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
