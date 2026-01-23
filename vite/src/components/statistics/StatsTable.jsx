import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { formatKg, formatPercent } from '../../utils/statistics';

const StatsTable = ({ 
  title, 
  description, 
  data, 
  columns, 
  formatValue = formatKg, 
  showTotal = true,
  totalValue = null,
  rowKey = 'name',
  valueKey = 'value'
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left px-2 py-1 text-[11px] font-semibold whitespace-nowrap">
                  {columns?.[0]?.label || 'Flux'}
                </th>
                <th className="text-right px-2 py-1 text-[11px] font-semibold whitespace-nowrap">
                  {columns?.[1]?.label || 'Total (kg)'}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item[rowKey]} className="border-b">
                  <td className="px-2 py-1">{item[rowKey]}</td>
                  <td className="px-2 py-1 text-right">{formatValue(item[valueKey])}</td>
                </tr>
              ))}
              {showTotal && (
                <tr className="border-t-2 font-bold">
                  <td className="px-2 py-1">TOTAL</td>
                  <td className="px-2 py-1 text-right">
                    {formatValue(totalValue !== null ? totalValue : data.reduce((sum, item) => sum + (item[valueKey] || 0), 0))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

// Composant pour les tableaux multi-colonnes (détails par déchetterie)
export const MultiColumnStatsTable = ({
  title,
  description,
  data,
  columns,
  formatValue = formatKg,
  showTotal = true,
  totals = {},
  rowKey = 'name',
  isPercentage = false
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left px-2 py-1 text-[11px] font-semibold whitespace-nowrap">
                  {rowKey === 'name' ? 'Déchetterie' : rowKey}
                </th>
                {columns.map((col) => (
                  <th key={col} className="text-right px-2 py-1 text-[11px] font-semibold whitespace-nowrap">
                    {col} {isPercentage ? '(%)' : ''}
                  </th>
                ))}
                <th className="text-right px-2 py-1 text-[11px] font-bold whitespace-nowrap">
                  TOTAL {isPercentage ? '(%)' : '(kg)'}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item[rowKey]} className="border-b">
                  <td className="px-2 py-1 font-medium whitespace-nowrap">{item[rowKey]}</td>
                  {columns.map((col) => {
                    if (isPercentage) {
                      const denom = totals[col] || 0;
                      const value = denom ? (item[col] || 0) / denom * 100 : 0;
                      return (
                        <td key={col} className="px-2 py-1 text-right">
                          {formatPercent(value)}
                        </td>
                      );
                    }
                    return (
                      <td key={col} className="px-2 py-1 text-right">
                        {formatValue(item[col] || 0)}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-right font-bold">
                    {isPercentage ? (
                      formatPercent(
                        totals.TOTAL
                          ? (item.TOTAL || 0) / totals.TOTAL * 100
                          : 0
                      )
                    ) : (
                      formatValue(item.TOTAL || 0)
                    )}
                  </td>
                </tr>
              ))}
              {showTotal && (
                <tr className="border-t-2 font-bold">
                  <td className="px-2 py-1">TOTAL</td>
                  {columns.map((col) => (
                    <td key={col} className="px-2 py-1 text-right">
                      {isPercentage ? formatPercent(100) : formatValue(totals[col] || 0)}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right">
                    {isPercentage ? formatPercent(100) : formatValue(totals.TOTAL || 0)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatsTable;
