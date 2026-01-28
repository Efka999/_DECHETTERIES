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

