"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface HeatmapProps {
  data: Record<string, number>;
  bestTimes: { hour: number; day: string }[];
}

const dayLabels = ["月", "火", "水", "木", "金", "土", "日"];
const dayNameMap: Record<string, number> = {
  "月曜日": 0,
  "火曜日": 1,
  "水曜日": 2,
  "木曜日": 3,
  "金曜日": 4,
  "土曜日": 5,
  "日曜日": 6,
};

function getColorClass(value: number, max: number): string {
  if (max === 0 || value === 0) return "bg-muted";
  const ratio = value / max;
  if (ratio >= 0.8) return "bg-emerald-500";
  if (ratio >= 0.6) return "bg-emerald-400";
  if (ratio >= 0.4) return "bg-emerald-300";
  if (ratio >= 0.2) return "bg-emerald-200";
  return "bg-emerald-100";
}

export function InsightsHeatmap({ data, bestTimes }: HeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    hour: number;
    day: number;
    value: number;
  } | null>(null);

  // Find max value for color scaling
  const values = Object.values(data);
  const maxValue = values.length > 0 ? Math.max(...values) : 0;

  // Build best times lookup: dayIndex-hour
  const bestTimesSet = new Set<string>();
  for (const bt of bestTimes) {
    const dayIndex = dayNameMap[bt.day];
    if (dayIndex !== undefined) {
      bestTimesSet.add(`${dayIndex}-${bt.hour}`);
    }
  }

  // Show every 3 hours for labels
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
              {hour % 3 === 0 ? `${hour}` : ""}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex flex-col gap-0.5">
          {dayLabels.map((dayLabel, dayIndex) => (
            <div key={dayLabel} className="flex items-center gap-1">
              <div className="w-7 text-right text-xs font-medium text-muted-foreground shrink-0">
                {dayLabel}
              </div>
              <div className="flex-1 flex gap-0.5">
                {hourLabels.map((hour) => {
                  const key = `${hour}-${dayIndex}`;
                  const value = data[key] || 0;
                  const isBestTime = bestTimesSet.has(`${dayIndex}-${hour}`);

                  return (
                    <div
                      key={hour}
                      className={cn(
                        "flex-1 aspect-square rounded-sm cursor-default transition-all",
                        getColorClass(value, maxValue),
                        isBestTime && "ring-2 ring-primary ring-offset-1"
                      )}
                      onMouseEnter={() =>
                        setHoveredCell({ hour, day: dayIndex, value })
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
            {dayLabels[hoveredCell.day]}曜日 {hoveredCell.hour}時 - スコア:{" "}
            {hoveredCell.value}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-end gap-1 mt-3">
          <span className="text-[10px] text-muted-foreground mr-1">低</span>
          <div className="w-3 h-3 rounded-sm bg-muted" />
          <div className="w-3 h-3 rounded-sm bg-emerald-100" />
          <div className="w-3 h-3 rounded-sm bg-emerald-200" />
          <div className="w-3 h-3 rounded-sm bg-emerald-300" />
          <div className="w-3 h-3 rounded-sm bg-emerald-400" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-[10px] text-muted-foreground ml-1">高</span>
        </div>
      </div>
    </div>
  );
}
