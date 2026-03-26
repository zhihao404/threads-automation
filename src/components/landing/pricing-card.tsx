import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface PricingCardProps {
  name: string;
  nameJa: string;
  price: number;
  description: string;
  features: string[];
  highlighted?: boolean;
  ctaText: string;
  ctaHref: string;
}

export function PricingCard({
  name,
  nameJa,
  price,
  description,
  features,
  highlighted = false,
  ctaText,
  ctaHref,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card p-8 transition-all duration-300",
        highlighted
          ? "border-purple-500/50 shadow-xl shadow-purple-500/10 scale-[1.02]"
          : "hover:shadow-lg hover:shadow-purple-500/5"
      )}
    >
      {highlighted && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 px-4 py-1">
          おすすめ
        </Badge>
      )}

      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {name}
          </span>
        </div>
        <h3 className="mt-1 text-lg font-semibold">{nameJa}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="mb-6">
        {price === 0 ? (
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight">無料</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-medium text-muted-foreground">
              ¥
            </span>
            <span className="text-4xl font-bold tracking-tight">
              {price.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              /月
            </span>
          </div>
        )}
      </div>

      <ul className="mb-8 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        asChild
        size="lg"
        className={cn(
          "w-full",
          highlighted
            ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0"
            : ""
        )}
        variant={highlighted ? "default" : "outline"}
      >
        <Link href={ctaHref}>{ctaText}</Link>
      </Button>
    </div>
  );
}
