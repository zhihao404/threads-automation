"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface HourlyData {
  hour: number;
  avgViews: number;
  avgLikes: number;
  avgEngagement?: number;
  avgEngagementRate?: number;
  postCount: number;
}

interface DailyData {
  day: number; // 0=Sun
  avgViews: number;
  avgLikes: number;
  avgEngagement?: number;
  avgEngagementRate?: number;
  postCount: number;
}

interface TimeHeatmapProps {
  hourlyPerformance: HourlyData[];
  dailyPerformance: DailyData[];
}

// Japanese day labels: Mon-Sun order (matching common Japanese week display)
const DAY_LABELS = [
  { day: 1, label: "月" },
  { day: 2, label: "火" },
  { day: 3, label: "水" },
  { day: 4, label: "木" },
  { day: 5, label: "金" },
  { day: 6, label: "土" },
  { day: 0, label: "日" },
];

function getOpacity(value: number, max: number): number {
  if (max === 0 || value === 0) return 0;
  return Math.max(0.1, value / max);
}

export function TimeHeatmap({
  hourlyPerformance,
  dailyPerformance,
}: TimeHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    dayIndex: number;
    hour: number;
    engagement: number;
    postCount: number;
  } | null>(null);

  // Build a cross-tabulation: for each day x hour, estimate engagement
  // We use a combination: daily avg * hourly avg / global avg as a proxy
  const heatmapData = useMemo(() => {
    const hourlyMap = new Map<number, HourlyData>();
    for (const h of hourlyPerformance) {
      hourlyMap.set(h.hour, h);
    }

    const dailyMap = new Map<number, DailyData>();
    for (const d of dailyPerformance) {
      dailyMap.set(d.day, d);
    }

    // Calculate global averages
    const totalHourlyEng = hourlyPerformance.reduce((s, h) => s + (h.avgEngagement ?? h.avgEngagementRate ?? 0) * h.postCount, 0);
    const totalHourlyPosts = hourlyPerformance.reduce((s, h) => s + h.postCount, 0);
    const globalAvgEng = totalHourlyPosts > 0 ? totalHourlyEng / totalHourlyPosts : 0;

    const grid: number[][] = [];
    let maxVal = 0;

    for (const { day } of DAY_LABELS) {
      const row: number[] = [];
      const dayData = dailyMap.get(day);
      const dayEng = dayData ? (dayData.avgEngagement ?? dayData.avgEngagementRate ?? 0) : 0;

      for (let h = 0; h < 24; h++) {
        const hourData = hourlyMap.get(h);
        const hourEng = hourData ? (hourData.avgEngagement ?? hourData.avgEngagementRate ?? 0) : 0;

        // Estimate cross value
        let value: number;
        if (globalAvgEng > 0) {
          value = (dayEng * hourEng) / globalAvgEng;
        } else {
          value = (dayEng + hourEng) / 2;
        }

        row.push(Math.round(value * 100) / 100);
        if (value > maxVal) maxVal = value;
      }
      grid.push(row);
    }

    // Also store post count estimates
    const postCounts: number[][] = [];
    for (const { day } of DAY_LABELS) {
      const row: number[] = [];
      const dayData = dailyMap.get(day);
      for (let h = 0; h < 24; h++) {
        const hourData = hourlyMap.get(h);
        row.push((dayData?.postCount ?? 0) + (hourData?.postCount ?? 0));
      }
      postCounts.push(row);
    }

    return { grid, postCounts, maxVal };
  }, [hourlyPerformance, dailyPerformance]);

  const hasData = heatmapData.maxVal > 0;

  if (!hasData) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          データがありません
        </p>
      </div>
    );
  }

  // Find top 3 cells
  const topCells = new Set<string>();
  const flatCells: Array<{ dayIdx: number; hour: number; value: number }> = [];
  heatmapData.grid.forEach((row, dayIdx) => {
    row.forEach((val, hour) => {
      flatCells.push({ dayIdx, hour, value: val });
    });
  });
  flatCells
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .forEach((c) => topCells.add(`${c.dayIdx}-${c.hour}`));

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Hour labels */}
        <div className="flex items-end mb-1 pl-8">
          {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
            <div
              key={hour}
              className="flex-1 text-center text-[10px] text-muted-foreground"
            >
              {hour % 3 === 0 ? `${hour}` : ""}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        <div className="flex flex-col gap-0.5">
          {DAY_LABELS.map(({ label }, dayIdx) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-7 text-right text-xs font-medium text-muted-foreground shrink-0">
                {label}
              </div>
              <div className="flex-1 flex gap-0.5">
                {Array.from({ length: 24 }, (_, hour) => {
                  const value = heatmapData.grid[dayIdx][hour];
                  const opacity = getOpacity(value, heatmapData.maxVal);
                  const isTop = topCells.has(`${dayIdx}-${hour}`);
                  const isHovered =
                    hoveredCell?.dayIndex === dayIdx &&
                    hoveredCell?.hour === hour;

                  return (
                    <div
                      key={hour}
                      className={cn(
                        "flex-1 aspect-square rounded-sm cursor-default transition-all",
                        isTop && "ring-2 ring-primary ring-offset-1",
                        isHovered && "ring-2 ring-foreground ring-offset-1"
                      )}
                      style={{
                        backgroundColor:
                          value > 0
                            ? `color-mix(in oklch, var(--chart-1) ${Math.round(opacity * 100)}%, transparent)`
                            : "hsl(var(--muted))",
                      }}
                      onMouseEnter={() =>
                        setHoveredCell({
                          dayIndex: dayIdx,
                          hour,
                          engagement: value,
                          postCount: heatmapData.postCounts[dayIdx][hour],
                        })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Tooltip */}
        {hoveredCell && (
          <div className="mt-2 text-sm text-muted-foreground text-center">
            {DAY_LABELS[hoveredCell.dayIndex].label}曜日 {hoveredCell.hour}時 -
            エンゲージメント率: {hoveredCell.engagement.toFixed(2)}%
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-muted-foreground">
            * 上位のセルはハイライトされています
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground mr-1">低</span>
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((opacity, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-sm"
                style={{
                  backgroundColor:
                    opacity === 0
                      ? "hsl(var(--muted))"
                      : `color-mix(in oklch, var(--chart-1) ${Math.round(opacity * 100)}%, transparent)`,
                }}
              />
            ))}
            <span className="text-[10px] text-muted-foreground ml-1">高</span>
          </div>
        </div>
      </div>
    </div>
  );
}
