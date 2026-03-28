"use client";

import { format, addMinutes } from "date-fns";
import { ja } from "date-fns/locale";
import {
  GripVertical,
  X,
  Type,
  Image,
  Video,
  LayoutGrid,
  Clock,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QueueItemData {
  id: string;
  position: number;
  createdAt: string;
  postId: string;
  postContent: string;
  postMediaType: "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";
  postMediaUrls: string | null;
  postStatus: string;
  postTopicTag: string | null;
  postReplyControl: string;
  postCreatedAt: string;
  accountUsername: string;
  accountDisplayName: string | null;
}

interface QueueItemProps {
  item: QueueItemData;
  isFirst: boolean;
  estimatedPublishTime: Date | null;
  onRemove: (id: string) => void;
  isRemoving: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  isDragOver: boolean;
  isDragging: boolean;
}

const mediaTypeConfig: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  TEXT: { label: "テキスト", icon: Type },
  IMAGE: { label: "画像", icon: Image },
  VIDEO: { label: "動画", icon: Video },
  CAROUSEL: { label: "カルーセル", icon: LayoutGrid },
};

export function QueueItem({
  item,
  isFirst,
  estimatedPublishTime,
  onRemove,
  isRemoving,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isDragOver,
  isDragging,
}: QueueItemProps) {
  const mediaInfo = mediaTypeConfig[item.postMediaType] ?? mediaTypeConfig["TEXT"]!;
  const MediaIcon = mediaInfo.icon;

  const truncatedContent =
    item.postContent.length > 100
      ? item.postContent.slice(0, 100) + "..."
      : item.postContent;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onDragOver={(e) => onDragOver(e, item.id)}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop(e, item.id)}
      className={cn(
        "transition-all duration-150",
        isDragging && "opacity-40",
        isDragOver && "border-t-2 border-primary pt-1"
      )}
    >
      <Card
        className={cn(
          "group hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing",
          isFirst && "border-primary/50 bg-primary/5"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Drag Handle + Position */}
            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
              <GripVertical className="h-4 w-4 text-muted-foreground/50" />
              <span
                className={cn(
                  "text-sm font-bold w-6 text-center",
                  isFirst ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.position}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* First item indicator */}
              {isFirst && (
                <div className="flex items-center gap-1 mb-1.5">
                  <Badge className="bg-primary text-primary-foreground text-xs gap-1">
                    <Zap className="h-3 w-3" />
                    次に公開
                  </Badge>
                </div>
              )}

              {/* Post content preview */}
              <p className="text-sm leading-relaxed whitespace-pre-wrap mb-2">
                {truncatedContent}
              </p>

              {/* Meta row */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className="text-xs gap-1 font-normal"
                >
                  <MediaIcon className="h-3 w-3" />
                  {mediaInfo.label}
                </Badge>

                {item.postTopicTag && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    #{item.postTopicTag}
                  </span>
                )}

                <span className="text-xs text-muted-foreground">
                  @{item.accountUsername}
                </span>

                {/* Estimated publish time */}
                {estimatedPublishTime && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(estimatedPublishTime, "M/d HH:mm", {
                      locale: ja,
                    })}
                    頃
                  </span>
                )}
              </div>
            </div>

            {/* Remove button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => onRemove(item.id)}
              disabled={isRemoving}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Calculates estimated publish times for all items in the queue.
 */
export function calculateEstimatedTimes(
  itemCount: number,
  intervalMinutes: number,
  isPaused: boolean,
  nextPublishAt: string | null
): (Date | null)[] {
  if (isPaused || itemCount === 0) {
    return Array(itemCount).fill(null);
  }

  const baseTime = nextPublishAt ? new Date(nextPublishAt) : new Date();
  // If baseTime is in the past, use now as the starting point
  const startTime = baseTime > new Date() ? baseTime : new Date();

  return Array.from({ length: itemCount }, (_, i) =>
    addMinutes(startTime, i * intervalMinutes)
  );
}
