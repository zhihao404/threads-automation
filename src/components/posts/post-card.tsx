"use client";

import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Eye,
  Heart,
  MessageCircle,
  ExternalLink,
  Trash2,
  Calendar,
  Image,
  Video,
  Type,
  LayoutGrid,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MediaPreview } from "@/components/posts/media-preview";

export interface PostMetrics {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}

export interface PostData {
  id: string;
  accountId: string;
  threadsMediaId: string | null;
  content: string;
  mediaType: "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";
  mediaUrls: string | null;
  topicTag: string | null;
  replyControl: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  errorMessage: string | null;
  permalink: string | null;
  createdAt: string;
  updatedAt: string;
  accountUsername: string;
  accountDisplayName: string | null;
  accountProfilePicture: string | null;
  metrics: PostMetrics | null;
}

interface PostCardProps {
  post: PostData;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  published: {
    label: "公開済み",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  scheduled: {
    label: "予約済み",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  draft: {
    label: "下書き",
    className: "bg-gray-100 text-gray-800 border-gray-200",
  },
  failed: {
    label: "失敗",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  publishing: {
    label: "公開中",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  queued: {
    label: "キュー待ち",
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
};

const mediaTypeConfig: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  TEXT: { label: "テキスト", icon: Type },
  IMAGE: { label: "画像", icon: Image },
  VIDEO: { label: "動画", icon: Video },
  CAROUSEL: { label: "カルーセル", icon: LayoutGrid },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return format(date, "yyyy/MM/dd HH:mm", { locale: ja });
  } catch {
    return "";
  }
}

function parseMediaUrls(mediaUrls: string | null): string[] {
  if (!mediaUrls) return [];
  try {
    const parsed = JSON.parse(mediaUrls);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export function PostCard({ post, onDelete, isDeleting }: PostCardProps) {
  const statusInfo = statusConfig[post.status] ?? statusConfig["draft"]!;
  const mediaInfo = mediaTypeConfig[post.mediaType] ?? mediaTypeConfig["TEXT"]!
  const MediaIcon = mediaInfo.icon;

  const truncatedContent =
    post.content.length > 120
      ? post.content.slice(0, 120) + "..."
      : post.content;

  const parsedMediaUrls = parseMediaUrls(post.mediaUrls);

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        {/* Header: Account + Status + Media Type */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-muted-foreground truncate">
              @{post.accountUsername}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className="text-xs gap-1 font-normal"
            >
              <MediaIcon className="h-3 w-3" />
              {mediaInfo.label}
            </Badge>
            <Badge
              variant="outline"
              className={cn("text-xs font-normal", statusInfo.className)}
            >
              {statusInfo.label}
            </Badge>
          </div>
        </div>

        {/* Content Preview */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3">
          {truncatedContent}
        </p>

        {/* Topic Tag */}
        {post.topicTag && (
          <div className="mb-3">
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              #{post.topicTag}
            </span>
          </div>
        )}

        {/* Media Preview */}
        {parsedMediaUrls.length > 0 && post.mediaType !== "TEXT" && (
          <div className="mb-3">
            <MediaPreview
              mediaType={post.mediaType}
              mediaUrls={parsedMediaUrls}
              compact
            />
          </div>
        )}

        {/* Metrics Row (for published posts) */}
        {post.status === "published" && post.metrics && (
          <div className="flex items-center gap-4 mb-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {post.metrics.views.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              {post.metrics.likes.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {post.metrics.replies.toLocaleString()}
            </span>
          </div>
        )}

        {/* Scheduled Time */}
        {post.status === "scheduled" && post.scheduledAt && (
          <div className="flex items-center gap-1.5 mb-3 text-sm text-blue-600">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDate(post.scheduledAt)} に公開予定</span>
          </div>
        )}

        {/* Error Message */}
        {post.status === "failed" && post.errorMessage && (
          <div className="mb-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">
            {post.errorMessage}
          </div>
        )}

        {/* Footer: Date + Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDate(post.createdAt)}
          </div>
          <div className="flex items-center gap-1">
            {post.permalink && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                asChild
              >
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Threadsで見る
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(post.id)}
              disabled={isDeleting}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              削除
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
