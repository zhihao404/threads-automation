"use client";

import { cn } from "@/lib/utils";

interface UsageBarProps {
  label: string;
  current: number;
  limit: number; // -1 for unlimited
  unit?: string; // e.g., "投稿", "回", "個"
  compact?: boolean;
}

export function UsageBar({
  label,
  current,
  limit,
  unit = "",
  compact = false,
}: UsageBarProps) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;

  const barColor =
    percentage > 80
      ? "bg-red-500"
      : percentage > 60
        ? "bg-yellow-500"
        : "bg-emerald-500";

  const textColor =
    percentage > 80
      ? "text-red-600 dark:text-red-400"
      : percentage > 60
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-muted-foreground";

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {label}
        </span>
        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden min-w-[60px]">
          {!isUnlimited && (
            <div
              className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${percentage}%` }}
            />
          )}
        </div>
        <span className={cn("text-xs font-medium whitespace-nowrap", textColor)}>
          {isUnlimited ? (
            <>{current}{unit && ` ${unit}`}</>
          ) : (
            <>
              {current} / {limit}
              {unit && ` ${unit}`}
            </>
          )}
          {isUnlimited && (
            <span className="ml-1 text-muted-foreground">(無制限)</span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className={cn("text-sm", textColor)}>
          {isUnlimited ? (
            <>
              {current}
              {unit && ` ${unit}`}
              <span className="ml-1 text-muted-foreground">(無制限)</span>
            </>
          ) : (
            <>
              {current} / {limit}
              {unit && ` ${unit}`}
            </>
          )}
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        {isUnlimited ? (
          <div className="h-full w-0 rounded-full" />
        ) : (
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
      {!isUnlimited && percentage >= 80 && (
        <p className="text-xs text-red-500">
          上限に近づいています。プランのアップグレードをご検討ください。
        </p>
      )}
    </div>
  );
}
