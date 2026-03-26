"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Check, FileText, Type, Image, Video, LayoutGrid } from "lucide-react";

interface DraftPost {
  id: string;
  content: string;
  mediaType: "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";
  topicTag: string | null;
  createdAt: string;
  accountUsername: string;
}

interface AddToQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onAdded: () => void;
}

const mediaTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  TEXT: Type,
  IMAGE: Image,
  VIDEO: Video,
  CAROUSEL: LayoutGrid,
};

export function AddToQueueDialog({
  open,
  onOpenChange,
  accountId,
  onAdded,
}: AddToQueueDialogProps) {
  const [drafts, setDrafts] = useState<DraftPost[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const fetchDrafts = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        status: "draft",
        accountId,
        limit: "50",
      });
      const response = await fetch(`/api/posts?${params.toString()}`);
      if (!response.ok) {
        throw new Error("下書きの取得に失敗しました");
      }
      const data = (await response.json()) as {
        posts: Array<{
          id: string;
          content: string;
          mediaType: "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";
          topicTag: string | null;
          createdAt: string;
          accountUsername: string;
        }>;
      };
      setDrafts(
        data.posts.map((p) => ({
          id: p.id,
          content: p.content,
          mediaType: p.mediaType,
          topicTag: p.topicTag,
          createdAt: p.createdAt,
          accountUsername: p.accountUsername,
        }))
      );
    } catch {
      setError("下書きの読み込みに失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      fetchDrafts();
    }
  }, [open, fetchDrafts]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === drafts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(drafts.map((d) => d.id)));
    }
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;

    setIsAdding(true);
    setError("");

    try {
      // Add each selected draft to the queue sequentially
      for (const postId of selectedIds) {
        const response = await fetch("/api/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId, accountId }),
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          // Skip if already in queue (409), otherwise throw
          if (response.status !== 409) {
            throw new Error(data.error || "キューへの追加に失敗しました");
          }
        }
      }

      onAdded();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "キューへの追加に失敗しました"
      );
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>下書きをキューに追加</DialogTitle>
          <DialogDescription>
            キューに追加する下書きを選択してください。
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-md text-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              追加できる下書きがありません。
            </p>
          </div>
        ) : (
          <>
            {/* Select all / deselect all */}
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-muted-foreground">
                {drafts.length}件の下書き
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={toggleSelectAll}
              >
                {selectedIds.size === drafts.length
                  ? "すべて解除"
                  : "すべて選択"}
              </Button>
            </div>

            {/* Draft list */}
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0 max-h-[400px]">
              {drafts.map((draft) => {
                const isSelected = selectedIds.has(draft.id);
                const MediaIcon =
                  mediaTypeIcons[draft.mediaType] || mediaTypeIcons.TEXT;

                return (
                  <button
                    key={draft.id}
                    type="button"
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                    onClick={() => toggleSelect(draft.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox indicator */}
                      <div
                        className={`mt-0.5 h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2 whitespace-pre-wrap">
                          {draft.content}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge
                            variant="outline"
                            className="text-xs gap-1 font-normal"
                          >
                            <MediaIcon className="h-3 w-3" />
                          </Badge>
                          {draft.topicTag && (
                            <span className="text-xs text-muted-foreground">
                              #{draft.topicTag}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isAdding}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selectedIds.size === 0 || isAdding}
          >
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                追加中...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                {selectedIds.size}件をキューに追加
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
