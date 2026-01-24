import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatKg, formatExactDate } from '../../utils/statistics';

const MonthlyLineChart = ({ 
  data, 
  dataKey = 'total', 
  color = '#3b82f6', 
  height = 220, 
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
            <Line type="monotoneX" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} name="Total" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default MonthlyLineChart;
