"use client";

import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ReportCardProps {
  report: {
    id: string;
    type: "weekly" | "monthly";
    title: string;
    periodStart: string;
    periodEnd: string;
    summary: string;
    status: "generating" | "completed" | "failed";
    createdAt: string;
  };
}

export function ReportCard({ report }: ReportCardProps) {
  const typeLabel = report.type === "weekly" ? "週次" : "月次";
  const typeBadgeVariant =
    report.type === "weekly" ? "default" : "secondary";

  const statusIcon = {
    generating: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    failed: <AlertCircle className="h-4 w-4 text-destructive" />,
  };

  const statusLabel = {
    generating: "生成中...",
    completed: "完了",
    failed: "失敗",
  };

  const createdDate = new Date(report.createdAt);
  const createdStr = createdDate.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isClickable = report.status === "completed";

  const cardContent = (
    <Card
      className={
        isClickable
          ? "transition-colors hover:border-primary/50 cursor-pointer"
          : "opacity-80"
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold leading-tight line-clamp-2">
            {report.status === "generating"
              ? `${typeLabel}レポート生成中...`
              : report.title}
          </CardTitle>
          <Badge variant={typeBadgeVariant} className="shrink-0">
            {typeLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <Calendar className="h-3 w-3" />
          <span>
            {report.periodStart} 〜 {report.periodEnd}
          </span>
        </div>

        {report.status === "completed" && report.summary && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {report.summary}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs">
            {statusIcon[report.status]}
            <span className="text-muted-foreground">
              {statusLabel[report.status]}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{createdStr}</span>
        </div>
      </CardContent>
    </Card>
  );

  if (isClickable) {
    return <Link href={`/reports/${report.id}`}>{cardContent}</Link>;
  }

  return cardContent;
}
