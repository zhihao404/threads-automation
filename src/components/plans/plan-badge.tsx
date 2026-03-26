"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PlanBadgeProps {
  plan: "free" | "pro" | "business";
  className?: string;
}

const PLAN_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  free: {
    label: "Free",
    className: "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  },
  pro: {
    label: "Pro",
    className: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800",
  },
  business: {
    label: "Business",
    className: "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-800",
  },
};

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  const config = PLAN_CONFIG[plan] ?? PLAN_CONFIG.free;

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
