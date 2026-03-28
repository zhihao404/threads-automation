"use client";

import { useState, useCallback, useRef } from "react";
import { X, GripVertical, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UploadResult } from "@/lib/media";

interface CarouselManagerProps {
  items: UploadResult[];
  onReorder: (items: UploadResult[]) => void;
  onRemove: (key: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isVideoContent(contentType: string): boolean {
  return contentType.startsWith("video/");
}

export function CarouselManager({
  items,
  onReorder,
  onRemove,
}: CarouselManagerProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const itemCount = items.length;
  const isBelowMinimum = itemCount < 2;
  const isAtMaximum = itemCount >= 20;

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      setDragIndex(index);
      dragNodeRef.current = e.currentTarget;
      e.dataTransfer.effectAllowed = "move";
      // Required for Firefox
      e.dataTransfer.setData("text/plain", String(index));
      // Make the drag image semi-transparent
      requestAnimationFrame(() => {
        if (dragNodeRef.current) {
          dragNodeRef.current.style.opacity = "0.5";
        }
      });
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = "1";
    }
    setDragIndex(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragIndex !== null && dragIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [dragIndex]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === dropIndex) {
        setDragOverIndex(null);
        return;
      }

      const newItems = [...items];
      const [movedItem] = newItems.splice(dragIndex, 1) as [UploadResult];
      newItems.splice(dropIndex, 0, movedItem);
      onReorder(newItems);
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [dragIndex, items, onReorder]
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  return (
    <div className="space-y-3">
      {/* Status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {isBelowMinimum ? (
            <>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-yellow-600">
                あと{2 - itemCount}枚以上追加してください（最低2枚）
              </span>
            </>
          ) : isAtMaximum ? (
            <>
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <span className="text-orange-600">
                上限に達しました（最大20枚）
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">
                {itemCount}/20枚
              </span>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          ドラッグで並び替え
        </span>
      </div>

      {/* Items grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((item, index) => (
            <div
              key={item.key}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragLeave={handleDragLeave}
              className={cn(
                "relative group rounded-lg border bg-card overflow-hidden cursor-grab active:cursor-grabbing transition-all",
                dragIndex === index && "opacity-50",
                dragOverIndex === index &&
                  "border-primary ring-2 ring-primary/20"
              )}
            >
              {/* Position number */}
              <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-0.5 bg-black/60 text-white text-xs font-medium rounded px-1.5 py-0.5">
                <GripVertical className="h-3 w-3" />
                {index + 1}
              </div>

              {/* Remove button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-1 right-1 z-10 h-6 w-6 p-0 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(item.key)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>

              {/* Thumbnail */}
              <div className="aspect-square relative bg-muted">
                {isVideoContent(item.contentType) ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <div className="h-8 w-8 rounded-full bg-black/60 flex items-center justify-center">
                        <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-white ml-0.5" />
                      </div>
                      <span className="text-[10px]">動画</span>
                    </div>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={`カルーセル ${index + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>

              {/* File info */}
              <div className="px-2 py-1.5 text-[10px] text-muted-foreground truncate">
                {formatFileSize(item.size)}
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg border-dashed">
          メディアをアップロードしてカルーセルを作成
        </div>
      )}
    </div>
  );
}
