"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CronPreview } from "./cron-preview";
import {
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { describeCron } from "@/lib/cron/parser";

export interface RecurringScheduleData {
  id: string;
  accountId: string;
  templateId: string | null;
  cronExpression: string;
  timezone: string;
  isActive: boolean;
  lastRunAt: string | Date | null;
  nextRunAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  accountUsername: string;
  accountDisplayName: string | null;
  templateName: string | null;
  templateContent: string | null;
}

interface RecurringCardProps {
  schedule: RecurringScheduleData;
  onToggle: (id: string, isActive: boolean) => void;
  onEdit: (schedule: RecurringScheduleData) => void;
  onDelete: (id: string) => void;
}

function formatDateTimeJa(value: string | Date | null): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("ja-JP", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(value: string | Date | null): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) return "期限切れ";
  if (diffMinutes < 1) return "まもなく";
  if (diffMinutes < 60) return `${diffMinutes}分後`;
  if (diffHours < 24) return `${diffHours}時間後`;
  if (diffDays < 7) return `${diffDays}日後`;
  return `${Math.floor(diffDays / 7)}週間後`;
}

export function RecurringCard({
  schedule,
  onToggle,
  onEdit,
  onDelete,
}: RecurringCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);

  const description = describeCron(schedule.cronExpression);
  const hasTemplate = !!schedule.templateId && !!schedule.templateName;

  const statusColor = !schedule.isActive
    ? "bg-yellow-500/10 text-yellow-600 border-yellow-200"
    : !hasTemplate
      ? "bg-orange-500/10 text-orange-600 border-orange-200"
      : "bg-green-500/10 text-green-600 border-green-200";

  const statusText = !schedule.isActive
    ? "一時停止"
    : !hasTemplate
      ? "テンプレート未設定"
      : "有効";

  const handleToggle = async (checked: boolean) => {
    setToggling(true);
    try {
      await onToggle(schedule.id, checked);
    } finally {
      setToggling(false);
    }
  };

  return (
    <Card className={!schedule.isActive ? "opacity-60" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <h3 className="font-semibold text-base truncate">{description}</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={statusColor}>
                {statusText}
              </Badge>
              <span className="text-xs text-muted-foreground">
                @{schedule.accountUsername}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={schedule.isActive}
              onCheckedChange={handleToggle}
              disabled={toggling}
              aria-label="スケジュールの有効/無効"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Template info */}
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          {hasTemplate ? (
            <span className="truncate">{schedule.templateName}</span>
          ) : (
            <span className="text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
              テンプレート未設定
            </span>
          )}
        </div>

        {/* Timing info */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">次回実行: </span>
            {schedule.isActive && schedule.nextRunAt ? (
              <span className="text-foreground">
                {formatRelativeTime(schedule.nextRunAt)}
                <span className="ml-1 text-muted-foreground">
                  ({formatDateTimeJa(schedule.nextRunAt)})
                </span>
              </span>
            ) : (
              <span>-</span>
            )}
          </div>
          <div>
            <span className="font-medium">前回実行: </span>
            <span>{formatDateTimeJa(schedule.lastRunAt)}</span>
          </div>
        </div>

        {/* Expandable next runs preview */}
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            次の5回の実行予定
          </button>
          {expanded && (
            <div className="mt-2 p-3 rounded-md bg-muted/50">
              <CronPreview
                cronExpression={schedule.cronExpression}
                timezone={schedule.timezone}
                count={5}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(schedule)}
            className="text-xs"
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            編集
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(schedule.id)}
            className="text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            削除
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
