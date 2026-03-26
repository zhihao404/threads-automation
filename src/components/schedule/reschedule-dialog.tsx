"use client";

import { useState, useCallback } from "react";
import { format, addHours, addDays, addWeeks } from "date-fns";
import { ja } from "date-fns/locale";
import { Clock, Calendar, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ScheduledPost {
  id: string;
  content: string;
  mediaType: string;
  scheduledAt: string;
  accountId: string;
  accountUsername: string;
  accountDisplayName: string | null;
  accountProfilePicture: string | null;
  status: string;
}

interface RescheduleDialogProps {
  post: ScheduledPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRescheduled?: (postId: string, newDate: string) => void;
}

export function RescheduleDialog({
  post,
  open,
  onOpenChange,
  onRescheduled,
}: RescheduleDialogProps) {
  const currentDate = post ? new Date(post.scheduledAt) : new Date();
  const [date, setDate] = useState(format(currentDate, "yyyy-MM-dd"));
  const [time, setTime] = useState(format(currentDate, "HH:mm"));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Reset when post changes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen && post) {
        const d = new Date(post.scheduledAt);
        setDate(format(d, "yyyy-MM-dd"));
        setTime(format(d, "HH:mm"));
        setError("");
      }
      onOpenChange(newOpen);
    },
    [post, onOpenChange]
  );

  const applyQuickOffset = useCallback(
    (offsetFn: (date: Date) => Date) => {
      const current = new Date(`${date}T${time}`);
      const newDate = offsetFn(current);
      setDate(format(newDate, "yyyy-MM-dd"));
      setTime(format(newDate, "HH:mm"));
    },
    [date, time]
  );

  const handleSubmit = useCallback(async () => {
    if (!post) return;

    const newScheduledAt = new Date(`${date}T${time}`);
    if (newScheduledAt <= new Date()) {
      setError("過去の日時には予約できません。");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/posts/${post.id}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: newScheduledAt.toISOString() }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "リスケジュールに失敗しました");
      }

      onRescheduled?.(post.id, newScheduledAt.toISOString());
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "リスケジュールに失敗しました"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [post, date, time, onRescheduled, onOpenChange]);

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>投稿のリスケジュール</DialogTitle>
          <DialogDescription>
            新しい予約日時を設定してください。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Schedule */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              現在の予約日時
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(new Date(post.scheduledAt), "yyyy年M月d日 (EEEE)", {
                  locale: ja,
                })}
              </span>
              <Clock className="h-4 w-4 text-muted-foreground ml-2" />
              <span>{format(new Date(post.scheduledAt), "HH:mm")}</span>
            </div>
          </div>

          {/* Date & Time Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="reschedule-date"
                className="text-sm font-medium"
              >
                日付
              </label>
              <input
                id="reschedule-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="reschedule-time"
                className="text-sm font-medium"
              >
                時刻
              </label>
              <input
                id="reschedule-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Quick Buttons */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">クイック設定</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyQuickOffset((d) => addHours(d, 1))}
              >
                +1時間
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyQuickOffset((d) => addDays(d, 1))}
              >
                +1日
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyQuickOffset((d) => addWeeks(d, 1))}
              >
                +1週間
              </Button>
            </div>
          </div>

          {/* New schedule preview */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              新しい予約日時
            </p>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4 text-primary" />
              <span>
                {format(new Date(`${date}T${time}`), "yyyy年M月d日 (EEEE)", {
                  locale: ja,
                })}
              </span>
              <Clock className="h-4 w-4 text-primary ml-2" />
              <span>{time}</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            リスケジュール
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
