"use client";

import { useState, useMemo } from "react";
import { ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PostData {
  id: string;
  content: string;
  mediaType: string;
  publishedAt: string | Date | null;
  permalink: string | null;
  metrics: {
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    shares: number;
  };
  engagementRate: number;
}

interface PostPerformanceTableProps {
  posts: PostData[];
}

type SortKey = "publishedAt" | "views" | "likes" | "replies" | "reposts" | "engagementRate";
type SortDir = "asc" | "desc";

const MEDIA_TYPE_LABELS: Record<string, string> = {
  TEXT: "テキスト",
  IMAGE: "画像",
  VIDEO: "動画",
  CAROUSEL: "カルーセル",
};

const MEDIA_TYPE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  TEXT: "secondary",
  IMAGE: "default",
  VIDEO: "outline",
  CAROUSEL: "secondary",
};

const PAGE_SIZE = 20;

function formatDate(d: string | Date | null): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) {
    // Try timestamp (seconds)
    const ts = Number(d);
    if (!isNaN(ts)) {
      const fromTs = new Date(ts * 1000);
      return `${fromTs.getFullYear()}/${String(fromTs.getMonth() + 1).padStart(2, "0")}/${String(fromTs.getDate()).padStart(2, "0")}`;
    }
    return "-";
  }
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("ja-JP").format(n);
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDir }) {
  if (!active) {
    return <ChevronsUpDown className="h-3 w-3 ml-1 text-muted-foreground" />;
  }
  return direction === "asc" ? (
    <ChevronUp className="h-3 w-3 ml-1" />
  ) : (
    <ChevronDown className="h-3 w-3 ml-1" />
  );
}

export function PostPerformanceTable({ posts }: PostPerformanceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sortedPosts = useMemo(() => {
    const sorted = [...posts].sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortKey) {
        case "views":
          aVal = a.metrics.views;
          bVal = b.metrics.views;
          break;
        case "likes":
          aVal = a.metrics.likes;
          bVal = b.metrics.likes;
          break;
        case "replies":
          aVal = a.metrics.replies;
          bVal = b.metrics.replies;
          break;
        case "reposts":
          aVal = a.metrics.reposts;
          bVal = b.metrics.reposts;
          break;
        case "engagementRate":
          aVal = a.engagementRate;
          bVal = b.engagementRate;
          break;
        case "publishedAt": {
          const aDate = a.publishedAt ? new Date(typeof a.publishedAt === "string" ? a.publishedAt : Number(a.publishedAt) * 1000).getTime() : 0;
          const bDate = b.publishedAt ? new Date(typeof b.publishedAt === "string" ? b.publishedAt : Number(b.publishedAt) * 1000).getTime() : 0;
          aVal = aDate;
          bVal = bDate;
          break;
        }
        default:
          aVal = a.metrics.views;
          bVal = b.metrics.views;
      }

      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [posts, sortKey, sortDir]);

  const visiblePosts = sortedPosts.slice(0, visibleCount);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (posts.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          データがありません
        </p>
      </div>
    );
  }

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: "publishedAt", label: "投稿日" },
    { key: "views", label: "閲覧数" },
    { key: "likes", label: "いいね" },
    { key: "replies", label: "リプライ" },
    { key: "reposts", label: "リポスト" },
    { key: "engagementRate", label: "Eng率" },
  ];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-2 font-medium text-muted-foreground w-[30%]">
                コンテンツ
              </th>
              <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                タイプ
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-right py-2 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center justify-end">
                    {col.label}
                    <SortIcon
                      active={sortKey === col.key}
                      direction={sortDir}
                    />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiblePosts.map((post) => {
              const isExpanded = expandedId === post.id;
              return (
                <tr
                  key={post.id}
                  className={cn(
                    "border-b hover:bg-muted/50 cursor-pointer transition-colors",
                    isExpanded && "bg-muted/30"
                  )}
                  onClick={() =>
                    setExpandedId(isExpanded ? null : post.id)
                  }
                >
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[250px]">
                        {post.content.slice(0, 60)}
                        {post.content.length > 60 ? "..." : ""}
                      </span>
                      {post.permalink && (
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                        {post.content}
                        <div className="mt-2 flex gap-4">
                          <span>引用: {formatNumber(post.metrics.quotes)}</span>
                          <span>シェア: {formatNumber(post.metrics.shares)}</span>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <Badge
                      variant={MEDIA_TYPE_VARIANTS[post.mediaType] || "secondary"}
                    >
                      {MEDIA_TYPE_LABELS[post.mediaType] || post.mediaType}
                    </Badge>
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {formatDate(post.publishedAt)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {formatNumber(post.metrics.views)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {formatNumber(post.metrics.likes)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {formatNumber(post.metrics.replies)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {formatNumber(post.metrics.reposts)}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {post.engagementRate.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visibleCount < sortedPosts.length && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            もっと表示 ({sortedPosts.length - visibleCount} 件残り)
          </Button>
        </div>
      )}
    </div>
  );
}
