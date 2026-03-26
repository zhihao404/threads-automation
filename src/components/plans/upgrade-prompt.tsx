"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UpgradePromptProps {
  feature: string; // Human-readable feature name
  currentPlan: string;
  suggestedPlan: string;
  className?: string;
}

const PLAN_NAMES: Record<string, string> = {
  free: "フリー",
  pro: "プロ",
  business: "ビジネス",
};

export function UpgradePrompt({
  feature,
  currentPlan,
  suggestedPlan,
  className,
}: UpgradePromptProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const suggestedPlanName = PLAN_NAMES[suggestedPlan] ?? suggestedPlan;

  return (
    <Card className={cn("border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950", className)}>
      <CardContent className="flex items-start gap-4 p-4">
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className="h-5 w-5 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            プランをアップグレードして{feature}を解放しましょう
          </p>
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            現在のプラン: {PLAN_NAMES[currentPlan] ?? currentPlan} &rarr; おすすめ: {suggestedPlanName}プラン
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              asChild
            >
              <a href="/settings/billing">
                アップグレード
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-amber-600 hover:text-amber-700 dark:text-amber-400"
              onClick={() => setDismissed(true)}
            >
              閉じる
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
