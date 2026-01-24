import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { formatKg, formatExactDate } from '../../utils/statistics';

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toDate = (value) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDayIndex = (date) => (date.getDay() + 6) % 7; // Monday = 0

const buildCalendar = (startDate, endDate) => {
  const days = [];
  if (!startDate || !endDate) return days;

  const cursor = new Date(startDate);
  const end = new Date(endDate);

  cursor.setDate(cursor.getDate() - getDayIndex(cursor));

  while (cursor <= end || getDayIndex(cursor) !== 0) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
};

const FluxCalendarHeatmap = ({ title, description, series, dateRange }) => {
  const { calendarDays, maxValue, valueByDate } = useMemo(() => {
    const valueMap = new Map();
    let max = 0;

    Object.entries(series || {}).forEach(([date, value]) => {
      const numeric = Number(value || 0);
      valueMap.set(date, numeric);
      if (numeric > max) max = numeric;
    });

    const start = toDate(dateRange?.start);
    const end = toDate(dateRange?.end);
    const days = buildCalendar(start, end);

    return {
      calendarDays: days,
      maxValue: max,
      valueByDate: valueMap
    };
  }, [series, dateRange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <div className="flex flex-col gap-1">
            {DAY_LABELS.map((label) => (
              <span key={label} className="h-3 leading-3">
                {label}
              </span>
            ))}
          </div>
          <div
            className="grid gap-1"
            style={{
              gridAutoFlow: 'column',
              gridAutoColumns: 'minmax(10px, 10px)',
              gridTemplateRows: 'repeat(7, minmax(10px, 10px))'
            }}
          >
            {calendarDays.map((day) => {
              const iso = day.toISOString().slice(0, 10);
              const value = valueByDate.get(iso) || 0;
              const displayDate = formatExactDate(iso);
              const intensity = maxValue > 0 ? value / maxValue : 0;
              const alpha = clamp(0.08 + intensity * 0.85, 0.08, 0.93);
              const backgroundColor = value > 0 ? `rgba(94, 162, 38, ${alpha})` : 'rgba(148, 163, 184, 0.15)';
              return (
                <div
                  key={iso}
                  title={`${displayDate} • ${formatKg(value)} kg`}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor
                  }}
                />
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FluxCalendarHeatmap;
