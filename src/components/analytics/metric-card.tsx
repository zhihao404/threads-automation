"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: number;
  previousValue: number;
  icon: React.ComponentType<{ className?: string }>;
  formatter?: (n: number) => string;
}

const defaultFormatter = (n: number): string => {
  return new Intl.NumberFormat("ja-JP").format(n);
};

export function MetricCard({
  title,
  value,
  previousValue,
  icon: Icon,
  formatter = defaultFormatter,
}: MetricCardProps) {
  const change = previousValue > 0
    ? ((value - previousValue) / previousValue) * 100
    : value > 0
      ? 100
      : 0;

  const changeAbs = Math.abs(Math.round(change * 10) / 10);
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatter(value)}</div>
        <div className="flex items-center gap-1 mt-1">
          {isNeutral ? (
            <Minus className="h-3 w-3 text-muted-foreground" />
          ) : isPositive ? (
            <TrendingUp className="h-3 w-3 text-emerald-500" />
          ) : (
            <TrendingDown className="h-3 w-3 text-destructive" />
          )}
          <p
            className={cn(
              "text-xs",
              isNeutral && "text-muted-foreground",
              isPositive && "text-emerald-500",
              !isPositive && !isNeutral && "text-destructive"
            )}
          >
            {isNeutral
              ? "前期間と同じ"
              : `${isPositive ? "+" : "-"}${changeAbs}% 前期間比`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
