"use client";

import { MessageCircle, EyeOff, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ReplyStatsProps {
  total: number;
  hidden: number;
  today: number;
}

interface StatItemProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}

function StatItem({ title, value, icon: Icon }: StatItemProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {new Intl.NumberFormat("ja-JP").format(value)}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReplyStats({ total, hidden, today }: ReplyStatsProps) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
      <StatItem title="リプライ総数" value={total} icon={MessageCircle} />
      <StatItem title="非表示" value={hidden} icon={EyeOff} />
      <StatItem title="今日のリプライ" value={today} icon={CalendarClock} />
    </div>
  );
}
