"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ListOrdered,
  Plus,
  Trash2,
  Loader2,
  Inbox,
  Pause,
  Play,
} from "lucide-react";
import { QueueItem, calculateEstimatedTimes } from "./queue-item";
import type { QueueItemData } from "./queue-item";
import { AddToQueueDialog } from "./add-to-queue-dialog";

interface QueueSettings {
  intervalMinutes: number;
  isPaused: boolean;
  nextPublishAt: string | null;
}

interface QueueListProps {
  accountId: string;
}

const INTERVAL_OPTIONS = [
  { value: "15", label: "15分" },
  { value: "30", label: "30分" },
  { value: "60", label: "1時間" },
  { value: "120", label: "2時間" },
  { value: "240", label: "4時間" },
  { value: "480", label: "8時間" },
  { value: "720", label: "12時間" },
  { value: "1440", label: "24時間" },
];

function QueueSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="animate-pulse flex items-start gap-3">
              <div className="h-5 w-10 bg-muted rounded shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-full bg-muted rounded" />
                <div className="h-4 w-2/3 bg-muted rounded" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-muted rounded" />
                  <div className="h-5 w-24 bg-muted rounded" />
                </div>
              </div>
              <div className="h-7 w-7 bg-muted rounded shrink-0" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function QueueList({ accountId }: QueueListProps) {
  const [items, setItems] = useState<QueueItemData[]>([]);
  const [settings, setSettings] = useState<QueueSettings>({
    intervalMinutes: 60,
    isPaused: false,
    nextPublishAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Drag and drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/queue?accountId=${encodeURIComponent(accountId)}`
      );
      if (!response.ok) {
        throw new Error("キューの取得に失敗しました");
      }
      const data = (await response.json()) as {
        items: QueueItemData[];
        settings: QueueSettings;
      };
      setItems(data.items || []);
      setSettings(
        data.settings || {
          intervalMinutes: 60,
          isPaused: false,
          nextPublishAt: null,
        }
      );
    } catch {
      setError("キューの読み込みに失敗しました。再度お試しください。");
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Save settings to API
  const saveSettings = useCallback(
    async (newSettings: QueueSettings) => {
      setIsSavingSettings(true);
      try {
        const response = await fetch("/api/queue/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            intervalMinutes: newSettings.intervalMinutes,
            isPaused: newSettings.isPaused,
          }),
        });
        if (!response.ok) {
          throw new Error("設定の保存に失敗しました");
        }
        const data = (await response.json()) as { settings: QueueSettings };
        setSettings(data.settings);
      } catch {
        setError("設定の保存に失敗しました。");
      } finally {
        setIsSavingSettings(false);
      }
    },
    [accountId]
  );

  const handleIntervalChange = (value: string) => {
    const newSettings = {
      ...settings,
      intervalMinutes: parseInt(value, 10),
    };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handlePauseToggle = (checked: boolean) => {
    // checked = true means "active" (not paused), so isPaused = !checked
    const newSettings = {
      ...settings,
      isPaused: !checked,
    };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleRemove = async (queueItemId: string) => {
    setRemovingId(queueItemId);
    try {
      const response = await fetch(`/api/queue/${queueItemId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("キューからの削除に失敗しました");
      }
      // Remove from local state and update positions
      setItems((prev) => {
        const removed = prev.find((item) => item.id === queueItemId);
        if (!removed) return prev;
        return prev
          .filter((item) => item.id !== queueItemId)
          .map((item) => ({
            ...item,
            position:
              item.position > removed.position
                ? item.position - 1
                : item.position,
          }));
      });
    } catch {
      setError("キューからの削除に失敗しました。");
    } finally {
      setRemovingId(null);
    }
  };

  const handleClearQueue = async () => {
    setIsClearing(true);
    try {
      const response = await fetch("/api/queue", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (!response.ok) {
        throw new Error("キューのクリアに失敗しました");
      }
      setItems([]);
      setShowClearDialog(false);
    } catch {
      setError("キューのクリアに失敗しました。");
    } finally {
      setIsClearing(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== draggedId) {
      setDragOverId(id);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    targetId: string
  ) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain");
    setDraggedId(null);
    setDragOverId(null);

    if (sourceId === targetId) return;

    const sourceIndex = items.findIndex((item) => item.id === sourceId);
    const targetIndex = items.findIndex((item) => item.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    // Reorder locally
    const newItems = [...items];
    const [movedItem] = newItems.splice(sourceIndex, 1) as [QueueItemData];
    newItems.splice(targetIndex, 0, movedItem);

    // Update positions
    const reorderedItems = newItems.map((item, index) => ({
      ...item,
      position: index + 1,
    }));

    setItems(reorderedItems);

    // Send reorder to API
    try {
      const response = await fetch("/api/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: reorderedItems.map((item) => ({
            id: item.id,
            position: item.position,
          })),
        }),
      });
      if (!response.ok) {
        throw new Error("並び替えに失敗しました");
        // On failure, re-fetch to restore correct state
      }
    } catch {
      setError("並び替えに失敗しました。再読み込みします...");
      fetchQueue();
    }
  };

  const estimatedTimes = calculateEstimatedTimes(
    items.length,
    settings.intervalMinutes,
    settings.isPaused,
    settings.nextPublishAt
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">
            投稿キュー
            {items.length > 0 && (
              <span className="text-muted-foreground font-normal ml-2">
                ({items.length}件)
              </span>
            )}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            下書きから追加
          </Button>
          {items.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowClearDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              クリア
            </Button>
          )}
        </div>
      </div>

      {/* Settings */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Pause/Resume toggle */}
            <div className="flex items-center gap-3">
              <Switch
                id="queue-active"
                checked={!settings.isPaused}
                onCheckedChange={handlePauseToggle}
                disabled={isSavingSettings}
              />
              <Label
                htmlFor="queue-active"
                className="flex items-center gap-1.5 cursor-pointer"
              >
                {settings.isPaused ? (
                  <>
                    <Pause className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">一時停止中</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 text-green-600" />
                    <span>稼働中</span>
                  </>
                )}
              </Label>
            </div>

            <Separator orientation="vertical" className="hidden sm:block h-6" />

            {/* Interval setting */}
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">投稿間隔</Label>
              <Select
                value={String(settings.intervalMinutes)}
                onValueChange={handleIntervalChange}
                disabled={isSavingSettings}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Queue Items */}
      {isLoading ? (
        <QueueSkeleton />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">キューは空です</h3>
          <p className="text-sm text-muted-foreground mb-6">
            下書きの投稿をキューに追加すると、設定した間隔で自動的に公開されます。
          </p>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            下書きから追加
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <QueueItem
              key={item.id}
              item={item}
              isFirst={index === 0}
              estimatedPublishTime={estimatedTimes[index] ?? null}
              onRemove={handleRemove}
              isRemoving={removingId === item.id}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              isDragOver={dragOverId === item.id}
              isDragging={draggedId === item.id}
            />
          ))}
        </div>
      )}

      {/* Add to Queue Dialog */}
      <AddToQueueDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        accountId={accountId}
        onAdded={fetchQueue}
      />

      {/* Clear Queue Confirmation Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>キューをクリア</DialogTitle>
            <DialogDescription>
              キュー内のすべての投稿を削除します。投稿は下書きに戻されます。この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearDialog(false)}
              disabled={isClearing}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearQueue}
              disabled={isClearing}
            >
              {isClearing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  クリア中...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  すべてクリア
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
