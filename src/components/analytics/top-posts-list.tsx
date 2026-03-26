"use client";

import { Eye, Heart, MessageCircle, Repeat2, Quote, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TopPostsListProps {
  posts: Array<{
    id: string;
    content: string;
    mediaType: string;
    publishedAt: string;
    permalink?: string | null;
    metrics: {
      views: number;
      likes: number;
      replies: number;
      reposts: number;
      quotes: number;
    };
    engagementRate: number;
  }>;
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  TEXT: "テキスト",
  IMAGE: "画像",
  VIDEO: "動画",
  CAROUSEL: "カルーセル",
};

const MEDIA_TYPE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  TEXT: "outline",
  IMAGE: "secondary",
  VIDEO: "default",
  CAROUSEL: "secondary",
};

const numberFormatter = new Intl.NumberFormat("ja-JP");

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

export function TopPostsList({ posts }: TopPostsListProps) {
  if (posts.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">データがありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post, index) => (
        <div
          key={post.id}
          className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
        >
          {/* Rank */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {index + 1}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm leading-relaxed line-clamp-2">
              {post.content}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={MEDIA_TYPE_VARIANTS[post.mediaType] ?? "outline"}>
                {MEDIA_TYPE_LABELS[post.mediaType] ?? post.mediaType}
              </Badge>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
              >
                {post.engagementRate}%
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(post.publishedAt)}
              </span>
              {post.permalink && (
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                  Threads
                </a>
              )}
            </div>

            {/* Metrics row */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {numberFormatter.format(post.metrics.views)}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {numberFormatter.format(post.metrics.likes)}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {numberFormatter.format(post.metrics.replies)}
              </span>
              <span className="flex items-center gap-1">
                <Repeat2 className="h-3 w-3" />
                {numberFormatter.format(post.metrics.reposts)}
              </span>
              <span className="flex items-center gap-1">
                <Quote className="h-3 w-3" />
                {numberFormatter.format(post.metrics.quotes)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
