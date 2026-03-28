"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PostStatusChartProps {
  data: { published: number; scheduled: number; draft: number; failed: number };
}

const STATUS_CONFIG = [
  { key: "published", label: "公開済み", color: "#22c55e" },
  { key: "scheduled", label: "予約済み", color: "#3b82f6" },
  { key: "draft", label: "下書き", color: "#9ca3af" },
  { key: "failed", label: "失敗", color: "#ef4444" },
] as const;

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { color: string };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0]!;
  return (
    <div className="rounded-lg border bg-background p-2 shadow-md">
      <div className="flex items-center gap-2 text-sm">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: entry.payload.color }}
        />
        <span>{entry.name}:</span>
        <span className="font-medium">{entry.value}件</span>
      </div>
    </div>
  );
}

export function PostStatusChart({ data }: PostStatusChartProps) {
  const total = data.published + data.scheduled + data.draft + data.failed;
  const chartData = STATUS_CONFIG.map((config) => ({
    name: config.label,
    value: data[config.key],
    color: config.color,
  })).filter((d) => d.value > 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>投稿ステータス</CardTitle>
          <CardDescription>ステータス別の投稿数</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            投稿がありません
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>投稿ステータス</CardTitle>
        <CardDescription>ステータス別の投稿数</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "12px" }}
                formatter={(value: string) => (
                  <span className="text-sm text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ marginBottom: 32 }}>
            <div className="text-center">
              <div className="text-2xl font-bold">{total}</div>
              <div className="text-xs text-muted-foreground">合計</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
