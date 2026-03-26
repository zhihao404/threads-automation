"use client";

import { useMemo } from "react";
import { describeCron, getNextRunTimes, isValidCron } from "@/lib/cron/parser";
import { Clock, CalendarDays } from "lucide-react";

interface CronPreviewProps {
  cronExpression: string;
  timezone: string;
  count?: number;
}

function formatDateJa(date: Date, timezone: string): string {
  return date.toLocaleString("ja-JP", {
    timeZone: timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "まもなく";
  if (diffMinutes < 60) return `${diffMinutes}分後`;
  if (diffHours < 24) return `${diffHours}時間後`;
  if (diffDays < 7) return `${diffDays}日後`;
  return `${Math.floor(diffDays / 7)}週間後`;
}

export function CronPreview({
  cronExpression,
  timezone,
  count = 5,
}: CronPreviewProps) {
  const description = useMemo(() => {
    if (!cronExpression || !isValidCron(cronExpression)) return null;
    return describeCron(cronExpression);
  }, [cronExpression]);

  const nextRuns = useMemo(() => {
    if (!cronExpression || !isValidCron(cronExpression)) return [];
    try {
      return getNextRunTimes(cronExpression, timezone, count);
    } catch {
      return [];
    }
  }, [cronExpression, timezone, count]);

  if (!cronExpression || !isValidCron(cronExpression)) {
    return (
      <div className="text-sm text-muted-foreground">
        有効なスケジュールを設定してください
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {description && (
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{description}</span>
        </div>
      )}
      {nextRuns.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>次回の実行予定</span>
          </div>
          <ul className="space-y-1 text-sm">
            {nextRuns.map((date, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {formatDateJa(date, timezone)}
                </span>
                {i === 0 && (
                  <span className="text-primary font-medium">
                    {formatRelativeTime(date)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
