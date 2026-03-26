"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface EngagementBreakdownProps {
  data: {
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    shares: number;
  };
}

const LABELS: Record<string, string> = {
  likes: "いいね",
  replies: "リプライ",
  reposts: "リポスト",
  quotes: "引用",
  shares: "シェア",
};

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const numberFormatter = new Intl.NumberFormat("ja-JP");

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { name: string; value: number; percentage: number };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-sm font-medium">{d.name}</p>
      <p className="text-sm text-muted-foreground">
        {numberFormatter.format(d.value)} ({d.percentage}%)
      </p>
    </div>
  );
}

interface CustomLabelProps {
  cx: number;
  cy: number;
  total: number;
}

function CenterLabel({ cx, cy, total }: CustomLabelProps) {
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="central"
      className="fill-foreground"
    >
      <tspan x={cx} dy="-0.5em" fontSize={22} fontWeight="bold">
        {numberFormatter.format(total)}
      </tspan>
      <tspan x={cx} dy="1.5em" fontSize={11} className="fill-muted-foreground">
        合計
      </tspan>
    </text>
  );
}

export function EngagementBreakdown({ data }: EngagementBreakdownProps) {
  const total =
    data.likes + data.replies + data.reposts + data.quotes + data.shares;

  if (total === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">データがありません</p>
      </div>
    );
  }

  const chartData = Object.entries(data)
    .map(([key, value]) => ({
      key,
      name: LABELS[key] ?? key,
      value,
      percentage: Math.round((value / total) * 1000) / 10,
    }))
    .filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
        >
          {chartData.map((entry, index) => (
            <Cell
              key={entry.key}
              fill={COLORS[index % COLORS.length]}
              strokeWidth={0}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value: string) => (
            <span className="text-sm text-foreground">{value}</span>
          )}
        />
        <CenterLabel cx={0} cy={0} total={total} />
        {/* Render center text manually via customized label */}
        <Pie
          data={[{ value: 1 }]}
          cx="50%"
          cy="50%"
          innerRadius={0}
          outerRadius={0}
          dataKey="value"
          isAnimationActive={false}
          label={({ cx, cy }: { cx: number; cy: number }) => (
            <g>
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-foreground"
              >
                <tspan x={cx} dy="-0.5em" fontSize={22} fontWeight="bold">
                  {numberFormatter.format(total)}
                </tspan>
                <tspan
                  x={cx}
                  dy="1.5em"
                  fontSize={11}
                  className="fill-muted-foreground"
                >
                  合計
                </tspan>
              </text>
            </g>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
