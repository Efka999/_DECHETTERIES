import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658'];

/**
 * FinalFluxesPanel - Displays special final fluxes (MASSICOT, DEMANTELEMENT, DECHETS ULTIMES)
 * in separate table and charts
 */
export function FinalFluxesPanel({ stats }) {
  if (!stats || !stats.final_fluxes_totals) {
    return null;
  }

  const finalFluxes = stats.final_fluxes || [];
  const finalFluxesTotals = stats.final_fluxes_totals || {};
  const dechetteries = stats.dechetteries || {};

  // Prepare data for table
  const tableData = finalFluxes.map(flux => ({
    name: flux,
    total: finalFluxesTotals[flux] || 0,
  }));

  // Calculate total of final fluxes
  const totalFinalFluxes = tableData.reduce((sum, item) => sum + item.total, 0);

  // Prepare data for pie chart
  const pieData = tableData.map((item, idx) => ({
    name: item.name,
    value: item.total,
    color: COLORS[idx % COLORS.length],
  }));

  // Prepare data for bar chart by dechetterie
  const decheterieBarData = [];
  const standardOrder = [
    'Pépinière', 'Sanssac', 'St Germain', 'Polignac', 
    'Yssingeaux', 'Bas-en-Basset', 'Monistrol'
  ];
  
  for (const dech of standardOrder) {
    if (dech in dechetteries) {
      const dechData = dechetteries[dech].total || {};
      const row = { name: dech };
      for (const flux of finalFluxes) {
        // Convert from grams to tonnes (if needed)
        row[flux] = (dechData[flux] || 0) / 1000;
      }
      decheterieBarData.push(row);
    }
  }

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      return (
        <div className="bg-white p-2 border border-gray-300 rounded shadow">
          <p className="text-sm font-semibold">{payload[0].name}</p>
          <p className="text-sm text-blue-600">{value.toFixed(2)} tonnes</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Flux Finaux Spécialisés</h2>
        <p className="text-gray-600 mt-1">
          MASSICOT, DEMANTELEMENT et DECHETS ULTIMES - Traitements spéciaux
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {tableData.map((item, idx) => (
          <Card key={item.name} className="border-l-4" style={{ borderLeftColor: COLORS[idx % COLORS.length] }}>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">{item.name}</p>
                <p className="text-2xl font-bold text-gray-900">{item.total.toFixed(2)}</p>
                <p className="text-xs text-gray-500">tonnes</p>
              </div>
            </CardContent>
          </Card>
        ))}
        <Card className="border-l-4 border-purple-600 bg-purple-50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Total Flux Finaux</p>
              <p className="text-2xl font-bold text-purple-900">{totalFinalFluxes.toFixed(2)}</p>
              <p className="text-xs text-gray-500">tonnes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribution des Flux Finaux</CardTitle>
            <CardDescription>Répartition en pourcentage</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, value, percent }) => 
                    `${name}: ${value.toFixed(1)}T (${(percent * 100).toFixed(1)}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value.toFixed(2)}T`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart - Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total par Flux</CardTitle>
            <CardDescription>Comparaison des trois flux finaux</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tableData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis label={{ value: 'Tonnes', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" fill="#8884d8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown by Déchetterie */}
      {decheterieBarData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Flux Finaux par Déchetterie</CardTitle>
            <CardDescription>Distribution des trois flux spécialisés</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={decheterieBarData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis label={{ value: 'Tonnes', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {finalFluxes.map((flux, idx) => (
                  <Bar 
                    key={flux} 
                    dataKey={flux} 
                    fill={COLORS[idx % COLORS.length]}
                    radius={[8, 8, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tableau Détaillé</CardTitle>
          <CardDescription>Résumé des flux finaux par déchetterie</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Déchetterie</th>
                  {finalFluxes.map(flux => (
                    <th key={flux} className="px-4 py-3 text-right font-semibold text-gray-700">
                      {flux}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {decheterieBarData.map((row, idx) => (
                  <tr key={row.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                    {finalFluxes.map(flux => (
                      <td key={flux} className="px-4 py-3 text-right text-gray-700">
                        {(row[flux] || 0).toFixed(2)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {(finalFluxes.reduce((sum, flux) => sum + (row[flux] || 0), 0)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 border-t-2">
                <tr>
                  <td className="px-4 py-3 font-bold text-gray-900">TOTAL</td>
                  {finalFluxes.map(flux => (
                    <td key={flux} className="px-4 py-3 text-right font-bold text-gray-900">
                      {finalFluxesTotals[flux].toFixed(2)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold text-purple-900">
                    {totalFinalFluxes.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default FinalFluxesPanel;
