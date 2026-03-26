"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface PostingTimeHeatmapProps {
  hourlyData: Array<{
    hour: number;
    postCount: number;
    avgEngagementRate: number;
  }>;
  dailyData: Array<{
    day: number;
    postCount: number;
    avgEngagementRate: number;
  }>;
}

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const DAY_FULL_LABELS = [
  "日曜日",
  "月曜日",
  "火曜日",
  "水曜日",
  "木曜日",
  "金曜日",
  "土曜日",
];

function getColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "rgba(16, 185, 129, 0.05)";
  const ratio = value / max;
  if (ratio >= 0.8) return "rgba(16, 185, 129, 0.9)";
  if (ratio >= 0.6) return "rgba(16, 185, 129, 0.7)";
  if (ratio >= 0.4) return "rgba(16, 185, 129, 0.5)";
  if (ratio >= 0.2) return "rgba(16, 185, 129, 0.3)";
  return "rgba(16, 185, 129, 0.15)";
}

export function PostingTimeHeatmap({
  hourlyData,
  dailyData,
}: PostingTimeHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    day: number;
    hour: number;
  } | null>(null);

  // Build the matrix: combine hourly and daily data
  // For each cell (day, hour) the engagement = dailyRate * hourlyRate (weighted estimate)
  // Use a multiplicative model: cell_value = hourly_rate * daily_rate / avg_rate
  const { matrix, maxValue, topSlots } = useMemo(() => {
    const grid: Record<string, { rate: number; postCount: number }> = {};
    let maxVal = 0;

    // Simple model: cell value proportional to hourlyRate * dailyRate
    const hourlyRates = new Map<number, number>();
    const dailyRates = new Map<number, number>();

    for (const h of hourlyData) {
      hourlyRates.set(h.hour, h.avgEngagementRate);
    }
    for (const d of dailyData) {
      dailyRates.set(d.day, d.avgEngagementRate);
    }

    const hourlyPostCounts = new Map<number, number>();
    const dailyPostCounts = new Map<number, number>();
    for (const h of hourlyData) {
      hourlyPostCounts.set(h.hour, h.postCount);
    }
    for (const d of dailyData) {
      dailyPostCounts.set(d.day, d.postCount);
    }

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const hRate = hourlyRates.get(hour) ?? 0;
        const dRate = dailyRates.get(day) ?? 0;
        // Geometric mean-like combination
        const combined = Math.sqrt(hRate * dRate);
        const hPosts = hourlyPostCounts.get(hour) ?? 0;
        const dPosts = dailyPostCounts.get(day) ?? 0;
        const postCount = Math.round((hPosts + dPosts) / 2);

        grid[`${day}-${hour}`] = { rate: Math.round(combined * 100) / 100, postCount };
        if (combined > maxVal) maxVal = combined;
      }
    }

    // Find top 3 slots
    const slots = Object.entries(grid)
      .sort((a, b) => b[1].rate - a[1].rate)
      .slice(0, 3)
      .map((entry) => entry[0]);

    return { matrix: grid, maxValue: maxVal, topSlots: new Set(slots) };
  }, [hourlyData, dailyData]);

  const hoveredData = hoveredCell
    ? matrix[`${hoveredCell.day}-${hoveredCell.hour}`]
    : null;

  // Column labels (every 3 hours)
  const hourLabels = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Hour labels */}
        <div className="flex items-end mb-1 pl-8">
          {hourLabels.map((hour) => (
            <div
              key={hour}
              className="flex-1 text-center text-[10px] text-muted-foreground"
            >
              {hour % 3 === 0 ? `${hour}時` : ""}
            </div>
          ))}
        </div>

        {/* Grid rows: reorder to Mon-Sun (1,2,3,4,5,6,0) */}
        <div className="flex flex-col gap-0.5">
          {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => (
            <div key={dayIndex} className="flex items-center gap-1">
              <div className="w-7 text-right text-xs font-medium text-muted-foreground shrink-0">
                {DAY_LABELS[dayIndex]}
              </div>
              <div className="flex-1 flex gap-0.5">
                {hourLabels.map((hour) => {
                  const key = `${dayIndex}-${hour}`;
                  const cellData = matrix[key] ?? { rate: 0, postCount: 0 };
                  const isTop = topSlots.has(key);
                  const isHovered =
                    hoveredCell?.day === dayIndex &&
                    hoveredCell?.hour === hour;

                  return (
                    <div
                      key={hour}
                      className={cn(
                        "flex-1 aspect-square rounded-sm cursor-default transition-all",
                        isTop && "ring-2 ring-primary ring-offset-1",
                        isHovered && "ring-2 ring-foreground/50"
                      )}
                      style={{ backgroundColor: getColor(cellData.rate, maxValue) }}
                      onMouseEnter={() =>
                        setHoveredCell({ day: dayIndex, hour })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Hover tooltip */}
        {hoveredCell && hoveredData && (
          <div className="mt-2 text-sm text-muted-foreground text-center">
            {DAY_FULL_LABELS[hoveredCell.day]} {hoveredCell.hour}時: 平均エンゲージメント率{" "}
            {hoveredData.rate}%, 投稿数: {hoveredData.postCount}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-end gap-1 mt-3">
          <span className="text-[10px] text-muted-foreground mr-1">低</span>
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: "rgba(16, 185, 129, 0.05)" }}
          />
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: "rgba(16, 185, 129, 0.15)" }}
          />
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: "rgba(16, 185, 129, 0.3)" }}
          />
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: "rgba(16, 185, 129, 0.5)" }}
          />
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: "rgba(16, 185, 129, 0.7)" }}
          />
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: "rgba(16, 185, 129, 0.9)" }}
          />
          <span className="text-[10px] text-muted-foreground ml-1">高</span>
        </div>
      </div>
    </div>
  );
}
