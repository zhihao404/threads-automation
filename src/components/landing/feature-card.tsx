import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient?: string;
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  gradient = "from-purple-500/10 to-pink-500/10",
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-6 transition-all duration-300",
        "hover:shadow-lg hover:shadow-purple-500/5 hover:-translate-y-0.5"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          gradient
        )}
      />
      <div className="relative">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-base font-semibold tracking-tight">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
