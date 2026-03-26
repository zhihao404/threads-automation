"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PostCard, type PostData } from "@/components/posts/post-card";
import { Plus, FileText, Loader2 } from "lucide-react";

type TabStatus = "all" | "published" | "scheduled" | "draft" | "failed";

function PostSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="animate-pulse space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-muted rounded" />
              <div className="h-5 w-16 bg-muted rounded" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded" />
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="h-3 w-32 bg-muted rounded" />
            <div className="h-7 w-16 bg-muted rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ status }: { status: TabStatus }) {
  const messages: Record<TabStatus, { title: string; description: string }> = {
    all: {
      title: "投稿がありません",
      description: "最初の投稿を作成しましょう！",
    },
    published: {
      title: "公開済みの投稿がありません",
      description: "投稿を公開すると、ここに表示されます。",
    },
    scheduled: {
      title: "予約投稿がありません",
      description: "投稿を予約すると、ここに表示されます。",
    },
    draft: {
      title: "下書きがありません",
      description: "下書きを保存すると、ここに表示されます。",
    },
    failed: {
      title: "失敗した投稿がありません",
      description: "投稿の公開に失敗した場合、ここに表示されます。",
    },
  };

  const msg = messages[status];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1">{msg.title}</h3>
      <p className="text-sm text-muted-foreground mb-6">{msg.description}</p>
      <Button asChild>
        <Link href="/posts/new">
          <Plus className="h-4 w-4 mr-2" />
          新しい投稿を作成
        </Link>
      </Button>
    </div>
  );
}

export default function PostsPage() {
  const [activeTab, setActiveTab] = useState<TabStatus>("all");
  const [posts, setPosts] = useState<PostData[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchPosts = useCallback(async (status: TabStatus) => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      params.set("limit", "50");

      const response = await fetch(`/api/posts?${params.toString()}`);
      if (!response.ok) {
        throw new Error("投稿の取得に失敗しました");
      }
      const data = (await response.json()) as { posts: PostData[]; total: number };
      setPosts(data.posts || []);
      setTotal(data.total || 0);
    } catch {
      setError("投稿の読み込みに失敗しました。再度お試しください。");
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts(activeTab);
  }, [activeTab, fetchPosts]);

  const handleDelete = useCallback(
    async (postId: string) => {
      if (!confirm("この投稿を削除しますか？この操作は取り消せません。")) {
        return;
      }

      setDeletingId(postId);
      try {
        const response = await fetch(`/api/posts/${postId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("削除に失敗しました");
        }

        // Remove from local state
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setTotal((prev) => Math.max(0, prev - 1));
      } catch {
        alert("投稿の削除に失敗しました。もう一度お試しください。");
      } finally {
        setDeletingId(null);
      }
    },
    []
  );

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as TabStatus);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">投稿管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            投稿の作成、管理、パフォーマンスの確認ができます。
          </p>
        </div>
        <Button asChild>
          <Link href="/posts/new">
            <Plus className="h-4 w-4 mr-2" />
            新しい投稿
          </Link>
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">すべて</TabsTrigger>
          <TabsTrigger value="published">公開済み</TabsTrigger>
          <TabsTrigger value="scheduled">予約済み</TabsTrigger>
          <TabsTrigger value="draft">下書き</TabsTrigger>
          <TabsTrigger value="failed">失敗</TabsTrigger>
        </TabsList>

        {(
          ["all", "published", "scheduled", "draft", "failed"] as const
        ).map((tab) => (
          <TabsContent key={tab} value={tab}>
            {isLoading ? (
              <div className="grid gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <PostSkeleton key={i} />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <EmptyState status={tab} />
            ) : (
              <div className="space-y-4">
                {/* Post Count */}
                <div className="text-sm text-muted-foreground">
                  {total} 件の投稿
                </div>

                {/* Post List */}
                <div className="grid gap-4">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onDelete={handleDelete}
                      isDeleting={deletingId === post.id}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Floating New Post Button (mobile) */}
      <div className="fixed bottom-6 right-6 lg:hidden">
        <Button size="lg" className="rounded-full h-14 w-14 shadow-lg" asChild>
          <Link href="/posts/new">
            <Plus className="h-6 w-6" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
