import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatKg } from '../../utils/statistics';
import { COLORS } from '../../utils/statistics';

const DoubleDonutChart = ({ data, title, description, height = 400 }) => {
  // Préparer les données pour le camembert extérieur (catégories)
  const categoryData = useMemo(() => {
    const categoryMap = {};
    data.forEach((item) => {
      const cat = item.categorie || 'Non catégorisé';
      categoryMap[cat] = (categoryMap[cat] || 0) + (item.total || 0);
    });
    return Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  // Préparer les données pour le camembert intérieur (sous-catégories)
  // Organiser pour que les sous-catégories s'alignent avec leurs catégories parentes
  const subcategoryData = useMemo(() => {
    // Grouper les sous-catégories par catégorie
    const byCategory = {};
    data.forEach((item) => {
      const cat = item.categorie || 'Non catégorisé';
      if (!byCategory[cat]) {
        byCategory[cat] = [];
      }
      byCategory[cat].push({
        name: item.sous_categorie || 'Non spécifié',
        value: item.total || 0,
        category: cat,
      });
    });

    // Trier chaque groupe de sous-catégories par valeur décroissante
    Object.keys(byCategory).forEach((cat) => {
      byCategory[cat].sort((a, b) => b.value - a.value);
    });

    // Construire la liste finale en respectant l'ordre des catégories
    // Pour chaque catégorie, on ajoute ses sous-catégories dans l'ordre
    const result = [];
    categoryData.forEach((catItem) => {
      const subcats = byCategory[catItem.name] || [];
      // Prendre toutes les sous-catégories de cette catégorie
      result.push(...subcats.filter((item) => item.value > 0));
    });

    // Ajouter les sous-catégories restantes (catégories non dans categoryData)
    Object.keys(byCategory).forEach((cat) => {
      if (!categoryData.find((c) => c.name === cat)) {
        const subcats = byCategory[cat];
        result.push(...subcats.filter((item) => item.value > 0));
      }
    });

    return result;
  }, [data, categoryData]);

  // Générer des couleurs pour les catégories
  const categoryColors = useMemo(() => {
    const colors = [...COLORS];
    const colorMap = {};
    categoryData.forEach((item, index) => {
      colorMap[item.name] = colors[index % colors.length];
    });
    return colorMap;
  }, [categoryData]);

  // Générer des couleurs pour les sous-catégories (variations des couleurs de catégories)
  const subcategoryColors = useMemo(() => {
    const colors = [];
    subcategoryData.forEach((item) => {
      const baseColor = categoryColors[item.category] || COLORS[0];
      // Créer une variation plus claire de la couleur de base
      const rgb = hexToRgb(baseColor);
      if (rgb) {
        const lighter = `rgb(${Math.min(255, rgb.r + 40)}, ${Math.min(255, rgb.g + 40)}, ${Math.min(255, rgb.b + 40)})`;
        colors.push(lighter);
      } else {
        colors.push(baseColor);
      }
    });
    return colors;
  }, [subcategoryData, categoryColors]);

  const totalCategory = categoryData.reduce((sum, item) => sum + item.value, 0);
  const totalSubcategory = subcategoryData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="rounded-lg border bg-background p-3 shadow-md">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatKg(data.value)} kg
          </p>
          {data.payload.category && (
            <p className="text-xs text-muted-foreground">
              Catégorie: {data.payload.category}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="p-2 md:p-3 pt-2">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          {/* Légende à gauche */}
          <div className="w-full md:w-1/3 space-y-1 flex flex-col justify-center">
            <div className="text-sm font-medium mb-1">Catégories</div>
            <div className="space-y-0.5 max-h-[500px] overflow-y-auto">
              {categoryData.map((item, index) => {
                const percent = ((item.value / totalCategory) * 100).toFixed(1);
                return (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: categoryColors[item.name] }}
                    />
                    <span className="flex-1">{item.name}</span>
                    <span className="text-muted-foreground">{percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Graphique à droite */}
          <div className="w-full md:w-2/3 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={Math.min(height * 2, 500)}>
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Tooltip content={<CustomTooltip />} />
            {/* Cercle blanc au centre */}
            <circle cx="50%" cy="50%" r="80" fill="white" stroke="none" />
            
            {/* Camembert intérieur - Sous-catégories (entoure le cercle blanc) */}
            <Pie
              data={subcategoryData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => {
                if (percent < 0.08) return ''; // Masquer les labels trop petits
                return `${(percent * 100).toFixed(0)}%`;
              }}
              innerRadius={90}
              outerRadius={140}
              fill="#82ca9d"
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              {subcategoryData.map((entry, index) => {
                // Trouver la couleur de la catégorie parente
                const baseColor = categoryColors[entry.category] || COLORS[0];
                const rgb = hexToRgb(baseColor);
                let color = baseColor;
                if (rgb) {
                  // Créer une variation plus claire
                  color = `rgb(${Math.min(255, rgb.r + 50)}, ${Math.min(255, rgb.g + 50)}, ${Math.min(255, rgb.b + 50)})`;
                }
                return <Cell key={`subcell-${index}`} fill={color} />;
              })}
            </Pie>
            
            {/* Camembert extérieur - Catégories */}
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => {
                if (percent < 0.05) return ''; // Masquer les labels trop petits
                return `${(percent * 100).toFixed(0)}%`;
              }}
              innerRadius={150}
              outerRadius={200}
              fill="#8884d8"
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              {categoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={categoryColors[entry.name]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground text-center space-y-0.5">
          <p><strong>Extérieur:</strong> Catégories ({formatKg(totalCategory)} kg)</p>
          <p><strong>Intérieur:</strong> Sous-catégories ({formatKg(totalSubcategory)} kg)</p>
        </div>
      </CardContent>
    </Card>
  );
};

// Fonction utilitaire pour convertir hex en RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export default DoubleDonutChart;
