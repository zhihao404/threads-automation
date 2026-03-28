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

interface EngagementRateChartProps {
  data: Array<{
    date: string;
    engagementRate: number;
    views: number;
    likes: number;
    replies: number;
  }>;
}

const numberFormatter = new Intl.NumberFormat("ja-JP");

function formatDateLabel(dateStr: string): string {
  const parts = dateStr.split("-");
  return `${parseInt(parts[1]!)}/${parseInt(parts[2]!)}`;
}

function formatTooltipDate(dateStr: string): string {
  const parts = dateStr.split("-");
  return `${parts[0]}年${parseInt(parts[1]!)}月${parseInt(parts[2]!)}日`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: {
      date: string;
      engagementRate: number;
      views: number;
      likes: number;
      replies: number;
    };
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload[0] || !label) return null;

  const data = payload[0].payload;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-2 text-sm font-medium">{formatTooltipDate(label)}</p>
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: "var(--chart-1)" }}
          />
          <span className="text-muted-foreground">エンゲージメント率:</span>
          <span className="font-medium">{data.engagementRate}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-transparent" />
          <span className="text-muted-foreground">閲覧数:</span>
          <span className="font-medium">
            {numberFormatter.format(data.views)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-transparent" />
          <span className="text-muted-foreground">いいね:</span>
          <span className="font-medium">
            {numberFormatter.format(data.likes)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-transparent" />
          <span className="text-muted-foreground">リプライ:</span>
          <span className="font-medium">
            {numberFormatter.format(data.replies)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function EngagementRateChart({ data }: EngagementRateChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">データがありません</p>
      </div>
    );
  }

  const avgRate =
    data.reduce((sum, d) => sum + d.engagementRate, 0) / data.length;
  const roundedAvg = Math.round(avgRate * 100) / 100;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={data}
        margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="engRateGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--chart-1)"
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor="var(--chart-1)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateLabel}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={roundedAvg}
          stroke="var(--chart-3)"
          strokeDasharray="5 5"
          label={{
            value: `平均 ${roundedAvg}%`,
            position: "insideTopRight",
            fill: "var(--chart-3)",
            fontSize: 11,
          }}
        />
        <Area
          type="monotone"
          dataKey="engagementRate"
          name="エンゲージメント率"
          stroke="var(--chart-1)"
          fill="url(#engRateGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
