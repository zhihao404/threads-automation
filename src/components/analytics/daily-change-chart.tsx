"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

interface DailyChangeChartProps {
  data: Array<{ date: string; change: number }>;
}

interface TooltipPayloadEntry {
  value: number;
  dataKey: string;
  payload: { date: string; change: number };
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]!.payload;
  const dateStr = label
    ? format(parseISO(label), "M月d日(E)", { locale: ja })
    : "";

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-sm font-medium">{dateStr}</p>
      <p className="text-sm text-muted-foreground">
        増減:{" "}
        <span
          className={`font-semibold ${
            data.change > 0
              ? "text-emerald-600"
              : data.change < 0
                ? "text-red-500"
                : "text-foreground"
          }`}
        >
          {data.change > 0 ? "+" : ""}
          {data.change.toLocaleString()}
        </span>
      </p>
    </div>
  );
}

export function DailyChangeChart({ data }: DailyChangeChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          データがありません。メトリクスの収集が開始されるとグラフが表示されます。
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => {
            try {
              return format(parseISO(value), "M/d");
            } catch {
              return value;
            }
          }}
          className="text-xs"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(value: number) =>
            value > 0 ? `+${value}` : String(value)
          }
          className="text-xs"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.3} />
        <Bar dataKey="change" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.change > 0
                  ? "#059669"
                  : entry.change < 0
                    ? "#ef4444"
                    : "hsl(var(--muted))"
              }
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
