"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface SeriesConfig {
  key: string;
  name: string;
  color: string;
}

interface TrendChartProps {
  data: Array<Record<string, number | string>>;
  series: Array<SeriesConfig>;
  xAxisKey: string;
  height?: number;
}

export function TrendChart({
  data,
  series,
  xAxisKey,
  height = 350,
}: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed"
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground">
          データがありません
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(value: string) => {
            // Format YYYY-MM-DD to M/D
            if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
              const parts = value.split("-");
              return `${parseInt(parts[1]!)}/${parseInt(parts[2]!)}`;
            }
            return value;
          }}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(value: number) =>
            value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
            color: "hsl(var(--popover-foreground))",
          }}
          labelFormatter={(label) => {
            const labelStr = String(label);
            if (labelStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              const parts = labelStr.split("-");
              return `${parts[0]}年${parseInt(parts[1]!)}月${parseInt(parts[2]!)}日`;
            }
            return labelStr;
          }}
          formatter={(value, name) => [
            new Intl.NumberFormat("ja-JP").format(Number(value)),
            String(name),
          ]}
        />
        <Legend />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
