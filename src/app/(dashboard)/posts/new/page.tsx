"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PostForm, type AccountOption } from "@/components/posts/post-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, AlertCircle, LinkIcon } from "lucide-react";

export default function NewPostPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/posts"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">新しい投稿</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    }>
      <NewPostPageContent />
    </Suspense>
  );
}

function NewPostPageContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiContent, setAiContent] = useState<{ content: string; topicTag: string } | null>(null);

  // Read AI-generated content from sessionStorage
  useEffect(() => {
    if (searchParams.get("from") === "ai") {
      try {
        const stored = sessionStorage.getItem("ai-generated-content");
        if (stored) {
          const parsed = JSON.parse(stored) as { content: string; topicTag: string };
          setAiContent(parsed);
          sessionStorage.removeItem("ai-generated-content");
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const response = await fetch("/api/accounts");
        if (!response.ok) {
          throw new Error("アカウント情報の取得に失敗しました");
        }
        const data = (await response.json()) as { accounts: AccountOption[] };
        setAccounts(data.accounts || []);
      } catch {
        setError(
          "アカウント情報の読み込みに失敗しました。再度お試しください。"
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchAccounts();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/posts">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">新しい投稿</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/posts">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">新しい投稿</h1>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/posts">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">新しい投稿</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <LinkIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">
              Threadsアカウントが必要です
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              投稿を作成するには、まずThreadsアカウントを接続してください。
              設定ページからアカウントを追加できます。
            </p>
            <Button variant="outline" asChild>
              <Link href="/settings">設定ページへ</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/posts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">新しい投稿</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Threadsに投稿を作成します。
          </p>
        </div>
      </div>

      {/* Post Form */}
      <PostForm
        accounts={accounts}
        initialContent={aiContent?.content}
        initialTopicTag={aiContent?.topicTag}
      />
    </div>
  );
}
