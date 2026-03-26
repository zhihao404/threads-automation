"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CronPreview } from "./cron-preview";
import { buildCronExpression, isValidCron } from "@/lib/cron/parser";
import type { ScheduleConfig } from "@/lib/cron/parser";
import type { RecurringScheduleData } from "./recurring-card";
import { Loader2 } from "lucide-react";

interface TemplateOption {
  id: string;
  name: string;
  content: string;
}

interface AccountOption {
  id: string;
  username: string;
  displayName: string | null;
}

interface ScheduleEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    accountId: string;
    templateId?: string;
    cronExpression: string;
    timezone: string;
  }) => Promise<void>;
  editingSchedule?: RecurringScheduleData | null;
  accounts: AccountOption[];
  templates: TemplateOption[];
  defaultAccountId?: string;
}

const DAY_LABELS = [
  { value: 0, label: "日" },
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
  { value: 6, label: "土" },
];

const TIMEZONES = [
  { value: "Asia/Tokyo", label: "日本標準時 (JST)" },
  { value: "UTC", label: "協定世界時 (UTC)" },
  { value: "America/New_York", label: "東部標準時 (EST)" },
  { value: "America/Los_Angeles", label: "太平洋標準時 (PST)" },
  { value: "Europe/London", label: "グリニッジ標準時 (GMT)" },
  { value: "Asia/Shanghai", label: "中国標準時 (CST)" },
  { value: "Asia/Seoul", label: "韓国標準時 (KST)" },
];

/**
 * Parse a cron expression into a ScheduleConfig for the editor.
 * Returns null if the expression can't be mapped to a simple config.
 */
function parseCronToConfig(cron: string): ScheduleConfig | null {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return null;

  const [minuteF, hourF, domF, monthF, dowF] = fields;

  // Check if minute and hour are specific numbers
  const minute = parseInt(minuteF, 10);
  const hour = parseInt(hourF, 10);
  if (isNaN(minute) || isNaN(hour)) {
    return { frequency: "custom", time: "09:00", customCron: cron };
  }

  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  // Daily: M H * * *
  if (domF === "*" && monthF === "*" && dowF === "*") {
    return { frequency: "daily", time };
  }

  // Weekly: M H * * D
  if (domF === "*" && monthF === "*" && dowF !== "*") {
    const days = dowF.split(",").map(Number);
    if (days.some(isNaN)) {
      return { frequency: "custom", time, customCron: cron };
    }
    return { frequency: "weekly", time, daysOfWeek: days };
  }

  // Monthly: M H D * *
  if (domF !== "*" && monthF === "*" && dowF === "*") {
    const dom = parseInt(domF, 10);
    if (isNaN(dom)) {
      return { frequency: "custom", time, customCron: cron };
    }
    return { frequency: "monthly", time, dayOfMonth: dom };
  }

  return { frequency: "custom", time: "09:00", customCron: cron };
}

export function ScheduleEditor({
  open,
  onOpenChange,
  onSave,
  editingSchedule,
  accounts,
  templates,
  defaultAccountId,
}: ScheduleEditorProps) {
  const [saving, setSaving] = useState(false);
  const [accountId, setAccountId] = useState(defaultAccountId || "");
  const [templateId, setTemplateId] = useState<string>("");
  const [timezone, setTimezone] = useState("Asia/Tokyo");
  const [frequency, setFrequency] = useState<ScheduleConfig["frequency"]>("daily");
  const [time, setTime] = useState("09:00");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1]); // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [customCron, setCustomCron] = useState("0 9 * * *");
  const [cronError, setCronError] = useState("");

  const isEditing = !!editingSchedule;

  // Reset form when dialog opens/closes or editing schedule changes
  useEffect(() => {
    if (open) {
      if (editingSchedule) {
        setAccountId(editingSchedule.accountId);
        setTemplateId(editingSchedule.templateId || "");
        setTimezone(editingSchedule.timezone);

        const config = parseCronToConfig(editingSchedule.cronExpression);
        if (config) {
          setFrequency(config.frequency);
          setTime(config.time);
          if (config.daysOfWeek) setDaysOfWeek(config.daysOfWeek);
          if (config.dayOfMonth) setDayOfMonth(config.dayOfMonth);
          if (config.customCron) setCustomCron(config.customCron);
        }
      } else {
        setAccountId(defaultAccountId || (accounts[0]?.id ?? ""));
        setTemplateId("");
        setTimezone("Asia/Tokyo");
        setFrequency("daily");
        setTime("09:00");
        setDaysOfWeek([1]);
        setDayOfMonth(1);
        setCustomCron("0 9 * * *");
      }
      setCronError("");
    }
  }, [open, editingSchedule, defaultAccountId, accounts]);

  const cronExpression = useMemo(() => {
    const config: ScheduleConfig = {
      frequency,
      time,
      daysOfWeek: frequency === "weekly" ? daysOfWeek : undefined,
      dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
      customCron: frequency === "custom" ? customCron : undefined,
    };
    return buildCronExpression(config);
  }, [frequency, time, daysOfWeek, dayOfMonth, customCron]);

  const isValidExpression = useMemo(() => {
    return isValidCron(cronExpression);
  }, [cronExpression]);

  useEffect(() => {
    if (frequency === "custom") {
      setCronError(isValidCron(customCron) ? "" : "無効なCron式です");
    } else {
      setCronError("");
    }
  }, [customCron, frequency]);

  const toggleDay = useCallback((day: number) => {
    setDaysOfWeek((prev) => {
      if (prev.includes(day)) {
        // Don't allow deselecting the last day
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  }, []);

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.id === templateId);
  }, [templates, templateId]);

  const handleSave = async () => {
    if (!accountId || !isValidExpression) return;

    setSaving(true);
    try {
      await onSave({
        accountId,
        templateId: templateId || undefined,
        cronExpression,
        timezone,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save schedule:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "定期投稿スケジュールを編集" : "新規定期投稿スケジュール"}
          </DialogTitle>
          <DialogDescription>
            テンプレートを使って定期的に自動投稿するスケジュールを設定します。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Account selector */}
          <div className="space-y-2">
            <Label htmlFor="account">アカウント</Label>
            <Select value={accountId} onValueChange={setAccountId} disabled={isEditing}>
              <SelectTrigger id="account">
                <SelectValue placeholder="アカウントを選択" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    @{acc.username}
                    {acc.displayName ? ` (${acc.displayName})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Schedule type tabs */}
          <div className="space-y-2">
            <Label>スケジュール</Label>
            <Tabs
              value={frequency}
              onValueChange={(v) => setFrequency(v as ScheduleConfig["frequency"])}
            >
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="daily">毎日</TabsTrigger>
                <TabsTrigger value="weekly">毎週</TabsTrigger>
                <TabsTrigger value="monthly">毎月</TabsTrigger>
                <TabsTrigger value="custom">カスタム</TabsTrigger>
              </TabsList>

              {/* Daily */}
              <TabsContent value="daily" className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="time-daily">投稿時刻</Label>
                  <Input
                    id="time-daily"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
              </TabsContent>

              {/* Weekly */}
              <TabsContent value="weekly" className="space-y-3">
                <div className="space-y-2">
                  <Label>曜日</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAY_LABELS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleDay(value)}
                        className={`
                          h-9 w-9 rounded-md text-sm font-medium transition-colors
                          ${
                            daysOfWeek.includes(value)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }
                        `}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time-weekly">投稿時刻</Label>
                  <Input
                    id="time-weekly"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
              </TabsContent>

              {/* Monthly */}
              <TabsContent value="monthly" className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="day-of-month">日付</Label>
                  <Select
                    value={String(dayOfMonth)}
                    onValueChange={(v) => setDayOfMonth(parseInt(v, 10))}
                  >
                    <SelectTrigger id="day-of-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d}日
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time-monthly">投稿時刻</Label>
                  <Input
                    id="time-monthly"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
              </TabsContent>

              {/* Custom */}
              <TabsContent value="custom" className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="custom-cron">Cron式</Label>
                  <Input
                    id="custom-cron"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="0 9 * * *"
                    className="font-mono text-sm"
                  />
                  {cronError && (
                    <p className="text-xs text-destructive">{cronError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    5フィールド形式: 分 時 日 月 曜日 (例: 0 9 * * 1-5 = 平日9時)
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Template selector */}
          <div className="space-y-2">
            <Label htmlFor="template">テンプレート</Label>
            <Select value={templateId || "__none__"} onValueChange={(v) => setTemplateId(v === "__none__" ? "" : v)}>
              <SelectTrigger id="template">
                <SelectValue placeholder="テンプレートを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">なし</SelectItem>
                {templates.map((tmpl) => (
                  <SelectItem key={tmpl.id} value={tmpl.id}>
                    {tmpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
                {selectedTemplate.content}
              </div>
            )}
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="timezone">タイムゾーン</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {isValidExpression && (
            <div className="rounded-md border p-3">
              <CronPreview
                cronExpression={cronExpression}
                timezone={timezone}
                count={5}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !accountId || !isValidExpression}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "更新" : "作成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
