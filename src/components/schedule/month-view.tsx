"use client";

import { useMemo, useCallback, useRef } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { cn } from "@/lib/utils";
import type { ScheduledPost } from "./reschedule-dialog";

const DAY_HEADERS = ["日", "月", "火", "水", "木", "金", "土"] as const;

const CHART_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

interface MonthViewProps {
  currentDate: Date;
  selectedDate: Date;
  posts: ScheduledPost[];
  accountColorMap: Map<string, number>;
  onSelectDate: (date: Date) => void;
}

interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  posts: ScheduledPost[];
}

export function MonthView({
  currentDate,
  selectedDate,
  posts,
  accountColorMap,
  onSelectDate,
}: MonthViewProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const focusedIndexRef = useRef<number>(-1);

  const days = useMemo<DayCell[]>(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const allDays = eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd,
    });

    return allDays.map((day) => ({
      date: day,
      isCurrentMonth: isSameMonth(day, currentDate),
      isToday: isToday(day),
      isSelected: isSameDay(day, selectedDate),
      posts: posts.filter((post) =>
        isSameDay(parseISO(post.scheduledAt), day)
      ),
    }));
  }, [currentDate, selectedDate, posts]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = focusedIndexRef.current;
      if (currentIndex < 0) return;

      let nextIndex = currentIndex;

      switch (e.key) {
        case "ArrowRight":
          nextIndex = Math.min(currentIndex + 1, days.length - 1);
          e.preventDefault();
          break;
        case "ArrowLeft":
          nextIndex = Math.max(currentIndex - 1, 0);
          e.preventDefault();
          break;
        case "ArrowDown":
          nextIndex = Math.min(currentIndex + 7, days.length - 1);
          e.preventDefault();
          break;
        case "ArrowUp":
          nextIndex = Math.max(currentIndex - 7, 0);
          e.preventDefault();
          break;
        case "Enter":
        case " ":
          onSelectDate(days[currentIndex].date);
          e.preventDefault();
          return;
        default:
          return;
      }

      focusedIndexRef.current = nextIndex;
      const buttons = gridRef.current?.querySelectorAll<HTMLButtonElement>(
        "[data-day-button]"
      );
      buttons?.[nextIndex]?.focus();
    },
    [days, onSelectDate]
  );

  return (
    <div className="select-none" onKeyDown={handleKeyDown}>
      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b">
        {DAY_HEADERS.map((day, i) => (
          <div
            key={day}
            className={cn(
              "py-2 text-center text-xs font-medium text-muted-foreground",
              i === 0 && "text-red-500",
              i === 6 && "text-blue-500"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div ref={gridRef} className="grid grid-cols-7" role="grid">
        {days.map((day, index) => {
          const dayOfWeek = day.date.getDay();

          return (
            <button
              key={day.date.toISOString()}
              data-day-button
              type="button"
              tabIndex={day.isSelected ? 0 : -1}
              onClick={() => onSelectDate(day.date)}
              onFocus={() => {
                focusedIndexRef.current = index;
              }}
              className={cn(
                "relative flex flex-col items-start p-1.5 min-h-[80px] md:min-h-[100px] border-b border-r text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                !day.isCurrentMonth && "opacity-40",
                day.isSelected && "bg-accent",
                day.isToday && "ring-2 ring-primary ring-inset",
                "hover:bg-accent/50"
              )}
              role="gridcell"
              aria-label={`${format(day.date, "M月d日")}${day.posts.length > 0 ? ` ${day.posts.length}件の予約` : ""}`}
              aria-selected={day.isSelected}
            >
              {/* Day number */}
              <span
                className={cn(
                  "text-xs font-medium leading-none mb-1",
                  !day.isCurrentMonth && "text-muted-foreground",
                  day.isToday &&
                    "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center",
                  dayOfWeek === 0 &&
                    day.isCurrentMonth &&
                    !day.isToday &&
                    "text-red-500",
                  dayOfWeek === 6 &&
                    day.isCurrentMonth &&
                    !day.isToday &&
                    "text-blue-500"
                )}
              >
                {format(day.date, "d")}
              </span>

              {/* Post previews */}
              <div className="w-full space-y-0.5 mt-auto overflow-hidden">
                {day.posts.slice(0, 3).map((post) => {
                  const colorIndex =
                    accountColorMap.get(post.accountId) ?? 0;
                  return (
                    <div
                      key={post.id}
                      className={cn(
                        "flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight truncate",
                        "bg-muted/80"
                      )}
                      title={`${format(parseISO(post.scheduledAt), "HH:mm")} @${post.accountUsername}: ${post.content.slice(0, 30)}`}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          CHART_COLORS[colorIndex]
                        )}
                      />
                      <span className="truncate hidden md:inline">
                        {format(parseISO(post.scheduledAt), "HH:mm")}{" "}
                        {post.content.slice(0, 15)}
                      </span>
                      <span className="truncate md:hidden">
                        {format(parseISO(post.scheduledAt), "HH:mm")}
                      </span>
                    </div>
                  );
                })}
                {day.posts.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    +{day.posts.length - 3} 件
                  </div>
                )}
              </div>

              {/* Post count indicator (mobile) */}
              {day.posts.length > 0 && (
                <div className="absolute top-1 right-1 md:hidden">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-medium">
                    {day.posts.length}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
