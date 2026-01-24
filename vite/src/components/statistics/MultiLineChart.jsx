import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatKg, formatExactDate } from '../../utils/statistics';

const MultiLineChart = ({ 
  data, 
  categories, 
  colorMap, 
  visible, 
  onToggle, 
  height = 260, 
  title, 
  description,
  datasetYear 
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              tickFormatter={(label) => formatExactDate(label, datasetYear)}
            />
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
                if (typeof cat === 'string' && onToggle) {
                  onToggle(cat);
                }
              }}
            />
            {categories.map((cat) => (
              <Line
                key={cat}
                type="monotoneX"
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
  );
};

export default MultiLineChart;
