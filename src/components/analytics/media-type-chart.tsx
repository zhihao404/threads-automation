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

interface MediaTypeChartProps {
  data: Array<{
    mediaType: string;
    postCount: number;
    avgViews: number;
    avgLikes: number;
    avgEngagementRate: number;
  }>;
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  TEXT: "テキスト",
  IMAGE: "画像",
  VIDEO: "動画",
  CAROUSEL: "カルーセル",
};

const numberFormatter = new Intl.NumberFormat("ja-JP");

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !label) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-2 text-sm font-medium">
        {MEDIA_TYPE_LABELS[label] ?? label}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">
            {entry.dataKey === "avgEngagementRate"
              ? `${entry.value}%`
              : numberFormatter.format(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MediaTypeChart({ data }: MediaTypeChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">データがありません</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: MEDIA_TYPE_LABELS[d.mediaType] ?? d.mediaType,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
          }
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
        />
        <Bar
          yAxisId="left"
          dataKey="avgViews"
          name="平均閲覧数"
          fill="var(--chart-1)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          yAxisId="left"
          dataKey="avgLikes"
          name="平均いいね"
          fill="var(--chart-2)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          yAxisId="right"
          dataKey="avgEngagementRate"
          name="エンゲージメント率"
          fill="var(--chart-4)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
