"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

interface FollowerGrowthChartProps {
  data: Array<{ date: string; followers: number; change: number }>;
}

interface TooltipPayloadEntry {
  value: number;
  dataKey: string;
  payload: { date: string; followers: number; change: number };
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
        フォロワー数:{" "}
        <span className="font-semibold text-foreground">
          {data.followers.toLocaleString()}
        </span>
      </p>
      <p className="text-sm text-muted-foreground">
        日次増減:{" "}
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

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: { change: number; followers: number };
}

function CustomDot({ cx, cy, payload }: CustomDotProps) {
  if (!payload || !cx || !cy) return null;

  // Show dot for significant changes (>5% of average followers)
  const absChange = Math.abs(payload.change);
  const threshold = payload.followers * 0.05;

  if (absChange < threshold || absChange === 0) return null;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={payload.change > 0 ? "#059669" : "#ef4444"}
      stroke="white"
      strokeWidth={2}
    />
  );
}

export function FollowerGrowthChart({ data }: FollowerGrowthChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          データがありません。メトリクスの収集が開始されるとグラフが表示されます。
        </p>
      </div>
    );
  }

  const startValue = data[0]!.followers;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="followerGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#059669" stopOpacity={0.05} />
          </linearGradient>
        </defs>
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
          tickFormatter={(value: number) => value.toLocaleString()}
          className="text-xs"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={startValue}
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="3 3"
          strokeOpacity={0.5}
        />
        <Area
          type="monotone"
          dataKey="followers"
          stroke="#059669"
          strokeWidth={2}
          fill="url(#followerGradient)"
          dot={<CustomDot />}
          activeDot={{ r: 5, fill: "#059669", stroke: "white", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
