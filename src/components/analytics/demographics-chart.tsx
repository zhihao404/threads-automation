"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  type PieLabelRenderProps,
} from "recharts";

interface DemographicsChartProps {
  type: "country" | "city" | "age" | "gender";
  data: Array<{ label: string; value: number; percentage: number }>;
}

const GENDER_COLORS = ["#3b82f6", "#ec4899", "#a78bfa", "#94a3b8"];
const BAR_COLOR = "#6366f1";

interface BarTooltipPayloadEntry {
  value: number;
  dataKey: string;
  payload: { label: string; value: number; percentage: number };
}

function BarTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: BarTooltipPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]!.payload;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-sm font-medium">{data.label}</p>
      <p className="text-sm text-muted-foreground">
        人数:{" "}
        <span className="font-semibold text-foreground">
          {data.value.toLocaleString()}
        </span>
      </p>
      <p className="text-sm text-muted-foreground">
        割合:{" "}
        <span className="font-semibold text-foreground">{data.percentage}%</span>
      </p>
    </div>
  );
}

interface PieTooltipPayloadEntry {
  name: string;
  value: number;
  payload: { label: string; value: number; percentage: number };
}

function PieTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: PieTooltipPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]!.payload;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-sm font-medium">{data.label}</p>
      <p className="text-sm text-muted-foreground">
        人数:{" "}
        <span className="font-semibold text-foreground">
          {data.value.toLocaleString()}
        </span>
      </p>
      <p className="text-sm text-muted-foreground">
        割合:{" "}
        <span className="font-semibold text-foreground">{data.percentage}%</span>
      </p>
    </div>
  );
}

function translateGender(label: string): string {
  const map: Record<string, string> = {
    male: "男性",
    female: "女性",
    other: "その他",
    Male: "男性",
    Female: "女性",
    Other: "その他",
    M: "男性",
    F: "女性",
    U: "不明",
  };
  return map[label] || label;
}

interface LegendPayloadEntry {
  value: string;
  color: string;
}

function CustomLegend({ payload }: { payload?: LegendPayloadEntry[] }) {
  if (!payload) return null;

  return (
    <div className="flex flex-wrap justify-center gap-4 pt-2">
      {payload.map((entry, index) => (
        <div key={`legend-${index}`} className="flex items-center gap-1.5">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function HorizontalBarChart({
  data,
}: {
  data: Array<{ label: string; value: number; percentage: number }>;
}) {
  const top10 = data.slice(0, 10);

  if (top10.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">データがありません</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(280, top10.length * 40)}>
      <BarChart
        data={top10}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={75}
        />
        <Tooltip content={<BarTooltipContent />} />
        <Bar dataKey="value" fill={BAR_COLOR} radius={[0, 4, 4, 0]} barSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function VerticalBarChart({
  data,
}: {
  data: Array<{ label: string; value: number; percentage: number }>;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">データがありません</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="label"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <Tooltip content={<BarTooltipContent />} />
        <Bar dataKey="value" fill={BAR_COLOR} radius={[4, 4, 0, 0]} barSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DonutChart({
  data,
}: {
  data: Array<{ label: string; value: number; percentage: number }>;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">データがありません</p>
      </div>
    );
  }

  const translatedData = data.map((d) => ({
    ...d,
    label: translateGender(d.label),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={translatedData}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="45%"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={3}
          label={(props: PieLabelRenderProps) => {
            const label = String(props.name ?? "");
            const percentage =
              typeof props.percent === "number"
                ? Math.round(props.percent * 10000) / 100
                : 0;
            return `${label} ${percentage}%`;
          }}
          labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
        >
          {translatedData.map((_entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={GENDER_COLORS[index % GENDER_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip content={<PieTooltipContent />} />
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DemographicsChart({ type, data }: DemographicsChartProps) {
  switch (type) {
    case "country":
    case "city":
      return <HorizontalBarChart data={data} />;
    case "age":
      return <VerticalBarChart data={data} />;
    case "gender":
      return <DonutChart data={data} />;
    default:
      return <HorizontalBarChart data={data} />;
  }
}
