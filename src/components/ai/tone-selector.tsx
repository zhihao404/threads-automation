"use client";

import { cn } from "@/lib/utils";
import {
  Coffee,
  Briefcase,
  Smile,
  BookOpen,
  Heart,
  Flame,
} from "lucide-react";
import type { ToneType } from "@/lib/ai/generate";

interface ToneSelectorProps {
  value: ToneType;
  onChange: (tone: ToneType) => void;
}

const toneOptions: {
  value: ToneType;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "casual",
    label: "カジュアル",
    subtitle: "Casual",
    icon: Coffee,
  },
  {
    value: "professional",
    label: "ビジネス",
    subtitle: "Professional",
    icon: Briefcase,
  },
  {
    value: "humorous",
    label: "ユーモア",
    subtitle: "Humorous",
    icon: Smile,
  },
  {
    value: "informative",
    label: "情報発信",
    subtitle: "Informative",
    icon: BookOpen,
  },
  {
    value: "inspiring",
    label: "インスピレーション",
    subtitle: "Inspiring",
    icon: Heart,
  },
  {
    value: "provocative",
    label: "刺激的",
    subtitle: "Provocative",
    icon: Flame,
  },
];

export function ToneSelector({ value, onChange }: ToneSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {toneOptions.map(({ value: toneValue, label, subtitle, icon: Icon }) => (
        <button
          key={toneValue}
          type="button"
          onClick={() => onChange(toneValue)}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-center transition-all hover:bg-accent/50",
            value === toneValue
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-transparent bg-muted/50"
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5",
              value === toneValue
                ? "text-primary"
                : "text-muted-foreground"
            )}
          />
          <div>
            <p
              className={cn(
                "text-sm font-medium leading-tight",
                value === toneValue
                  ? "text-primary"
                  : "text-foreground"
              )}
            >
              {label}
            </p>
            <p className="text-[10px] text-muted-foreground">{subtitle}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
