"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KpiCardProps {
  title: string;
  value: number;
  previousValue?: number;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  format?: "number" | "compact";
}

const numberFormatter = new Intl.NumberFormat("ja-JP");
const compactFormatter = new Intl.NumberFormat("ja-JP", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatValue(value: number, format: "number" | "compact"): string {
  return format === "compact"
    ? compactFormatter.format(value)
    : numberFormatter.format(value);
}

export function KpiCard({
  title,
  value,
  change,
  icon: Icon,
  format = "number",
}: KpiCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === 0) {
      // Use requestAnimationFrame to avoid synchronous setState in effect
      animationRef.current = requestAnimationFrame(() => {
        setDisplayValue(0);
      });
      return () => {
        if (animationRef.current !== null) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }

    const duration = 600; // ms
    startTimeRef.current = null;

    function animate(timestamp: number) {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(eased * value));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value]);

  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {formatValue(displayValue, format)}
        </div>
        <div className="flex items-center gap-1 pt-1">
          {isPositive && <TrendingUp className="h-3 w-3 text-green-600" />}
          {isNegative && <TrendingDown className="h-3 w-3 text-red-500" />}
          {isNeutral && <Minus className="h-3 w-3 text-muted-foreground" />}
          <span
            className={`text-xs font-medium ${
              isPositive
                ? "text-green-600"
                : isNegative
                  ? "text-red-500"
                  : "text-muted-foreground"
            }`}
          >
            {change !== undefined
              ? `${change >= 0 ? "+" : ""}${change}%`
              : "---"}
          </span>
          <span className="text-xs text-muted-foreground">前期間比</span>
        </div>
      </CardContent>
    </Card>
  );
}
