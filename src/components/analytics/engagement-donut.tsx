"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface EngagementDonutProps {
  data: Record<string, number>;
}

const LABEL_MAP: Record<string, string> = {
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

export function EngagementDonut({ data }: EngagementDonutProps) {
  const entries = Object.entries(data)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      name: LABEL_MAP[key] || key,
      value,
    }));

  const total = entries.reduce((sum, e) => sum + e.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          データがありません
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={entries}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={2}
            dataKey="value"
          >
            {entries.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
              color: "hsl(var(--popover-foreground))",
            }}
            formatter={(value, name) => {
              const numValue = Number(value);
              return [
                `${new Intl.NumberFormat("ja-JP").format(numValue)} (${total > 0 ? Math.round((numValue / total) * 100) : 0}%)`,
                String(name),
              ];
            }}
          />
          <Legend
            formatter={(value: string) => (
              <span className="text-sm text-foreground">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginBottom: 30 }}>
        <div className="text-center">
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat("ja-JP").format(total)}
          </div>
          <div className="text-xs text-muted-foreground">合計</div>
        </div>
      </div>
    </div>
  );
}
