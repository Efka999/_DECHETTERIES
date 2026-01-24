import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { formatKg } from '../../utils/statistics';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const FluxHeatmap = ({ title, description, rows, columns }) => {
  const { maxValue } = useMemo(() => {
    let max = 0;
    rows.forEach((row) => {
      columns.forEach((col) => {
        const value = Number(row[col] || 0);
        if (value > max) max = value;
      });
    });
    return { maxValue: max };
  }, [rows, columns]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">
                  Déchetterie
                </th>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{row.name}</td>
                  {columns.map((col) => {
                    const value = Number(row[col] || 0);
                    const intensity = maxValue > 0 ? value / maxValue : 0;
                    const alpha = clamp(0.15 + intensity * 0.7, 0.15, 0.85);
                    const backgroundColor = `rgba(94, 162, 38, ${alpha})`;
                    return (
                      <td
                        key={col}
                        className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-white"
                        style={{ backgroundColor }}
                        title={`${formatKg(value)} kg`}
                      >
                        {formatKg(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default FluxHeatmap;
