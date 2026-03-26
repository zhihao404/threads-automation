"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { Heart, MessageCircle, Eye, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface RecentPost {
  id: string;
  content: string;
  status: string;
  mediaType: string;
  publishedAt: string | null;
  createdAt: string;
  metrics: { views: number; likes: number; replies: number } | null;
}

interface RecentPostsListProps {
  posts: RecentPost[];
}

const statusLabels: Record<string, string> = {
  published: "公開済み",
  scheduled: "予約済み",
  draft: "下書き",
  queued: "キュー",
  publishing: "公開中",
  failed: "失敗",
};

const statusVariants: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  published: "default",
  scheduled: "secondary",
  draft: "outline",
  queued: "secondary",
  publishing: "secondary",
  failed: "destructive",
};

const numberFormatter = new Intl.NumberFormat("ja-JP");

function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: ja,
    });
  } catch {
    return dateStr;
  }
}

export function RecentPostsList({ posts }: RecentPostsListProps) {
  if (posts.length === 0) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>最近の投稿</CardTitle>
            <CardDescription>最新のThreadsアクティビティ</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            投稿がありません
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>最近の投稿</CardTitle>
          <CardDescription>最新のThreadsアクティビティ</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/posts">
            すべて表示
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/posts?id=${post.id}`}
              className="block"
            >
              <div className="flex items-start gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                <div className="flex-1 space-y-1">
                  <p className="text-sm leading-relaxed line-clamp-2">
                    {post.content}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {post.publishedAt
                        ? formatRelativeTime(post.publishedAt)
                        : formatRelativeTime(post.createdAt)}
                    </span>
                    {post.metrics && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
                <Badge variant={statusVariants[post.status] ?? "outline"}>
                  {statusLabels[post.status] ?? post.status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
