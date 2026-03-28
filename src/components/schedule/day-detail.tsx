"use client";

import { useMemo } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Clock,
  Image,
  Video,
  Type,
  LayoutGrid,
  CalendarPlus,
  MoreHorizontal,
  CalendarClock,
  XCircle,
  Trash2,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ScheduledPost } from "./reschedule-dialog";

const CHART_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

const mediaTypeIcons: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  TEXT: { icon: Type, label: "テキスト" },
  IMAGE: { icon: Image, label: "画像" },
  VIDEO: { icon: Video, label: "動画" },
  CAROUSEL: { icon: LayoutGrid, label: "カルーセル" },
};

function getAccountColorIndex(accountId: string): number {
  let hash = 0;
  for (let i = 0; i < accountId.length; i++) {
    hash = (hash * 31 + accountId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % CHART_COLORS.length;
}

interface DayDetailProps {
  selectedDate: Date;
  posts: ScheduledPost[];
  accountColorMap: Map<string, number>;
  onReschedule: (post: ScheduledPost) => void;
  onCancel: (postId: string) => void;
  onDelete: (postId: string) => void;
}

export function DayDetail({
  selectedDate,
  posts,
  accountColorMap,
  onReschedule,
  onCancel,
  onDelete,
}: DayDetailProps) {
  const dayPosts = useMemo(() => {
    return posts
      .filter((post) => isSameDay(parseISO(post.scheduledAt), selectedDate))
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
  }, [posts, selectedDate]);

  const formattedDate = format(selectedDate, "M月d日 (EEEE)", { locale: ja });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <h3 className="text-sm font-semibold">{formattedDate}</h3>
          <p className="text-xs text-muted-foreground">
            {dayPosts.length > 0
              ? `${dayPosts.length} 件の予約投稿`
              : "予約投稿なし"}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/posts/new">
            <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
            投稿を追加
          </Link>
        </Button>
      </div>

      {/* Post List */}
      <ScrollArea className="flex-1">
        {dayPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">予約投稿がありません</p>
            <p className="text-xs text-muted-foreground mb-4">
              この日には予約された投稿がありません。
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/posts/new">
                <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
                新しい予約投稿を作成
              </Link>
            </Button>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {dayPosts.map((post) => {
              const colorIndex =
                accountColorMap.get(post.accountId) ??
                getAccountColorIndex(post.accountId);
              const mediaInfo = mediaTypeIcons[post.mediaType] ??
                mediaTypeIcons["TEXT"]!;
              const MediaIcon = mediaInfo.icon;
              const scheduledTime = format(
                parseISO(post.scheduledAt),
                "HH:mm"
              );

              return (
                <Card key={post.id} className="group">
                  <CardContent className="p-3">
                    {/* Time + Account */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {scheduledTime}
                        </div>
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full",
                            CHART_COLORS[colorIndex]
                          )}
                        />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onReschedule(post)}
                          >
                            <CalendarClock className="h-4 w-4 mr-2" />
                            リスケジュール
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onCancel(post.id)}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            予約をキャンセル
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onDelete(post.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Account info */}
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="h-5 w-5">
                        {post.accountProfilePicture && (
                          <AvatarImage
                            src={post.accountProfilePicture}
                            alt={post.accountUsername}
                          />
                        )}
                        <AvatarFallback className="text-[10px]">
                          {post.accountUsername.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground truncate">
                        @{post.accountUsername}
                      </span>
                    </div>

                    {/* Content Preview */}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-3 mb-2">
                      {post.content}
                    </p>

                    {/* Media type badge */}
                    <Badge
                      variant="outline"
                      className="text-xs gap-1 font-normal"
                    >
                      <MediaIcon className="h-3 w-3" />
                      {mediaInfo.label}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
