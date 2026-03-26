"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MediaTypeData {
  mediaType: string;
  count: number;
  avgViews: number;
  avgLikes: number;
  avgEngagement: number;
}

interface MediaComparisonChartProps {
  data: MediaTypeData[];
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  TEXT: "テキスト",
  IMAGE: "画像",
  VIDEO: "動画",
  CAROUSEL: "カルーセル",
};

export function MediaComparisonChart({ data }: MediaComparisonChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[350px] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          データがありません
        </p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    name: MEDIA_TYPE_LABELS[d.mediaType] || d.mediaType,
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
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
          formatter={(value, name) => [
            String(name) === "エンゲージメント率"
              ? `${value}%`
              : new Intl.NumberFormat("ja-JP").format(Number(value)),
            String(name),
          ]}
        />
        <Legend />
        <Bar
          dataKey="avgViews"
          name="平均閲覧数"
          fill="var(--chart-1)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="avgLikes"
          name="平均いいね"
          fill="var(--chart-2)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="avgEngagement"
          name="エンゲージメント率"
          fill="var(--chart-3)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
