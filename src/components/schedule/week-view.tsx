"use client";

import { useMemo, useCallback } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachHourOfInterval,
  format,
  isSameDay,
  isToday,
  parseISO,
  getHours,
  getMinutes,
  set,
} from "date-fns";
import { ja } from "date-fns/locale";
import { Image, Video, Type, LayoutGrid } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ScheduledPost } from "./reschedule-dialog";

const CHART_BG_COLORS = [
  "bg-chart-1/20 border-chart-1/40 hover:bg-chart-1/30",
  "bg-chart-2/20 border-chart-2/40 hover:bg-chart-2/30",
  "bg-chart-3/20 border-chart-3/40 hover:bg-chart-3/30",
  "bg-chart-4/20 border-chart-4/40 hover:bg-chart-4/30",
  "bg-chart-5/20 border-chart-5/40 hover:bg-chart-5/30",
];

const CHART_DOT_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

const mediaTypeIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  TEXT: Type,
  IMAGE: Image,
  VIDEO: Video,
  CAROUSEL: LayoutGrid,
};

const START_HOUR = 6;
const END_HOUR = 23;

interface WeekViewProps {
  currentDate: Date;
  selectedDate: Date;
  posts: ScheduledPost[];
  accountColorMap: Map<string, number>;
  onSelectDate: (date: Date) => void;
  onSelectPost: (post: ScheduledPost) => void;
}

export function WeekView({
  currentDate,
  selectedDate,
  posts,
  accountColorMap,
  onSelectDate,
  onSelectPost,
}: WeekViewProps) {
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate]);

  const hours = useMemo(() => {
    const dayStart = set(new Date(), {
      hours: START_HOUR,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
    });
    const dayEnd = set(new Date(), {
      hours: END_HOUR,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
    });
    return eachHourOfInterval({ start: dayStart, end: dayEnd });
  }, []);

  const postsByDay = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>();
    for (const day of weekDays) {
      const key = format(day, "yyyy-MM-dd");
      map.set(
        key,
        posts
          .filter((post) => isSameDay(parseISO(post.scheduledAt), day))
          .sort(
            (a, b) =>
              new Date(a.scheduledAt).getTime() -
              new Date(b.scheduledAt).getTime()
          )
      );
    }
    return map;
  }, [weekDays, posts]);

  const getPostPosition = useCallback((post: ScheduledPost) => {
    const date = parseISO(post.scheduledAt);
    const hour = getHours(date);
    const minute = getMinutes(date);
    const topOffset = (hour - START_HOUR) * 60 + minute;
    return { top: topOffset, height: 40 };
  }, []);

  // Keyboard navigation on day columns
  const handleDayKeyDown = useCallback(
    (e: React.KeyboardEvent, dayIndex: number) => {
      switch (e.key) {
        case "ArrowRight":
          if (dayIndex < 6) {
            onSelectDate(weekDays[dayIndex + 1]);
          }
          e.preventDefault();
          break;
        case "ArrowLeft":
          if (dayIndex > 0) {
            onSelectDate(weekDays[dayIndex - 1]);
          }
          e.preventDefault();
          break;
        case "Enter":
        case " ":
          onSelectDate(weekDays[dayIndex]);
          e.preventDefault();
          break;
      }
    },
    [weekDays, onSelectDate]
  );

  const hourHeight = 60; // 60px per hour
  const totalHeight = (END_HOUR - START_HOUR) * hourHeight;

  return (
    <div className="flex flex-col h-full">
      {/* Day Headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b sticky top-0 bg-background z-10">
        <div className="p-2" /> {/* Time column header */}
        {weekDays.map((day, i) => {
          const dayOfWeek = day.getDay();
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(day)}
              onKeyDown={(e) => handleDayKeyDown(e, i)}
              tabIndex={isSameDay(day, selectedDate) ? 0 : -1}
              className={cn(
                "flex flex-col items-center py-2 border-l transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                isSameDay(day, selectedDate) && "bg-accent",
                "hover:bg-accent/50"
              )}
            >
              <span
                className={cn(
                  "text-xs text-muted-foreground",
                  dayOfWeek === 0 && "text-red-500",
                  dayOfWeek === 6 && "text-blue-500"
                )}
              >
                {format(day, "EEE", { locale: ja })}
              </span>
              <span
                className={cn(
                  "text-sm font-medium mt-0.5",
                  isToday(day) &&
                    "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center",
                  dayOfWeek === 0 && !isToday(day) && "text-red-500",
                  dayOfWeek === 6 && !isToday(day) && "text-blue-500"
                )}
              >
                {format(day, "d")}
              </span>
            </button>
          );
        })}
      </div>

      {/* Time Grid */}
      <ScrollArea className="flex-1">
        <div
          className="grid grid-cols-[60px_repeat(7,1fr)] relative"
          style={{ height: `${totalHeight}px` }}
        >
          {/* Hour Labels */}
          <div className="relative">
            {hours.map((hour) => {
              const h = getHours(hour);
              const topPx = (h - START_HOUR) * hourHeight;
              return (
                <div
                  key={h}
                  className="absolute right-2 text-[10px] text-muted-foreground leading-none"
                  style={{ top: `${topPx}px`, transform: "translateY(-50%)" }}
                >
                  {format(hour, "H:mm")}
                </div>
              );
            })}
          </div>

          {/* Day Columns */}
          {weekDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayPosts = postsByDay.get(key) || [];

            return (
              <div key={key} className="relative border-l">
                {/* Hour grid lines */}
                {hours.map((hour) => {
                  const h = getHours(hour);
                  const topPx = (h - START_HOUR) * hourHeight;
                  return (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-border/50"
                      style={{ top: `${topPx}px` }}
                    />
                  );
                })}

                {/* Posts */}
                {dayPosts.map((post) => {
                  const { top, height } = getPostPosition(post);
                  const colorIndex =
                    accountColorMap.get(post.accountId) ?? 0;
                  const MediaIcon =
                    mediaTypeIcons[post.mediaType] || mediaTypeIcons.TEXT;

                  // Clamp position within visible range
                  if (top < 0 || top > totalHeight) return null;

                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => onSelectPost(post)}
                      className={cn(
                        "absolute left-0.5 right-0.5 rounded border px-1.5 py-0.5 text-left transition-colors cursor-pointer overflow-hidden",
                        CHART_BG_COLORS[colorIndex],
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                      style={{
                        top: `${top}px`,
                        minHeight: `${height}px`,
                      }}
                      title={`${format(parseISO(post.scheduledAt), "HH:mm")} @${post.accountUsername}: ${post.content.slice(0, 50)}`}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            CHART_DOT_COLORS[colorIndex]
                          )}
                        />
                        <span className="text-[10px] font-medium truncate">
                          {format(parseISO(post.scheduledAt), "HH:mm")}
                        </span>
                        <MediaIcon className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="text-[10px] leading-tight truncate text-muted-foreground">
                        @{post.accountUsername}
                      </div>
                      <div className="text-[10px] leading-tight truncate">
                        {post.content.slice(0, 30)}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
