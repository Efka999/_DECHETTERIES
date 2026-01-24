// Constantes
export const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#84cc16'];

export const MONTH_INFO = {
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

// Formatage
export const formatKg = (value) => Math.round(Number(value || 0)).toLocaleString('fr-FR');

export const formatPercent = (value) => {
  const n = Number(value || 0);
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
};

// Normalisation
export const normalizeMonthKey = (value) =>
  String(value || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const getMonthInfo = (value) => MONTH_INFO[normalizeMonthKey(value)];

export const formatMonthYear = (value, year) => {
  const strValue = String(value || '');
  const isoDayMatch = strValue.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isoDayMatch) {
    const date = new Date(`${strValue}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('fr-FR');
    }
  }
  const isoMonthMatch = strValue.match(/^\d{4}-\d{2}$/);
  if (isoMonthMatch) {
    const date = new Date(`${strValue}-01T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
  }
  const isoWeekMatch = strValue.match(/^(\d{4})-(\d{2})$/);
  if (isoWeekMatch && strValue.includes('W') === false) {
    // handled above
  }
  const weekMatch = strValue.match(/^(\d{4})-W?(\d{2})$/i);
  if (weekMatch && strValue.includes('W')) {
    return `Semaine ${weekMatch[2]} ${weekMatch[1]}`;
  }
  const info = getMonthInfo(value);
  if (!info) return strValue;
  return year ? `${info.label} ${year}` : info.label;
};

export const formatExactDate = (value, year) => {
  const strValue = String(value || '');
  const isoDayMatch = strValue.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isoDayMatch) {
    const date = new Date(`${strValue}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('fr-FR');
    }
  }
  const isoMonthMatch = strValue.match(/^\d{4}-\d{2}$/);
  if (isoMonthMatch) {
    const date = new Date(`${strValue}-01T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }
  }
  const weekMatch = strValue.match(/^(\d{4})-W?(\d{2})$/i);
  if (weekMatch && strValue.includes('W')) {
    return `Semaine ${weekMatch[2]} ${weekMatch[1]}`;
  }
  const info = getMonthInfo(value);
  if (!info) return strValue;
  if (!year) return info.label;
  return `01 ${info.label} ${year}`;
};

export const normalizeName = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\s-]+/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// Utilitaires de date
export const inferYearFromFilename = (filename) => {
  const match = String(filename || '').match(/(19|20)\d{2}/);
  return match ? match[0] : null;
};

export const buildRangeLabel = (months, year) => {
  if (!months || months.length === 0) {
    return year ? `${year}` : '';
  }
  const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  if (months.every(isIsoDate)) {
    const sortedDates = [...months].sort();
    const start = sortedDates[0];
    const end = sortedDates[sortedDates.length - 1];
    if (start === end) {
      return formatExactDate(start, year);
    }
    return `${formatExactDate(start, year)} → ${formatExactDate(end, year)}`;
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

export const formatDuAuRange = (label) => {
  if (!label) return '';
  if (label.toUpperCase().startsWith('DU ')) return label;
  const parts = label.split('→').map((item) => item.trim()).filter(Boolean);
  if (parts.length === 2) {
    return `DU ${parts[0]} AU ${parts[1]}`;
  }
  return `DU ${label}`;
};

// Construction de données
export const buildCategoryColorMap = (categories) => {
  const map = {};
  (categories || []).forEach((cat, idx) => {
    map[cat] = COLORS[idx % COLORS.length];
  });
  return map;
};

export const buildFinalFluxColorMap = (finalFluxes) => {
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

export const buildGlobalMonthlyData = (stats) => {
  return (stats.months_order || []).map((month) => {
    let total = 0;
    Object.values(stats.dechetteries || {}).forEach((data) => {
      total += data.months?.[month]?.TOTAL || 0;
    });
    return { month, total };
  });
};

export const smoothTimeSeries = (data, keys, windowSize = 7) => {
  if (!Array.isArray(data) || data.length === 0) return data;
  const window = Math.max(1, Number(windowSize) || 1);
  const keyList = Array.isArray(keys) ? keys : [keys];

  return data.map((entry, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = data.slice(start, index + 1);
    const smoothed = { ...entry };

    keyList.forEach((key) => {
      const total = slice.reduce((sum, item) => sum + (Number(item?.[key]) || 0), 0);
      smoothed[key] = total / slice.length;
    });

    return smoothed;
  });
};

export const combineStats = (t1Stats, t2Stats) => {
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
