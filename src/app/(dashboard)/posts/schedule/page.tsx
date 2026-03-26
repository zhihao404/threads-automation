"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { CalendarView } from "@/components/schedule/calendar-view";
import type { ScheduledPost } from "@/components/schedule/reschedule-dialog";

interface Account {
  id: string;
  username: string;
  displayName: string | null;
  profilePictureUrl: string | null;
}

export default function SchedulePage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPosts = useCallback(async (accountId?: string) => {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ status: "scheduled", limit: "100" });
      if (accountId && accountId !== "all") {
        params.set("accountId", accountId);
      }

      const response = await fetch(`/api/posts?${params.toString()}`);
      if (!response.ok) {
        throw new Error("投稿の取得に失敗しました");
      }

      const data = (await response.json()) as {
        posts: Array<{
          id: string;
          content: string;
          mediaType: string;
          scheduledAt: string;
          accountId: string;
          accountUsername: string;
          accountDisplayName: string | null;
          accountProfilePicture: string | null;
          status: string;
        }>;
        total: number;
      };

      const scheduledPosts: ScheduledPost[] = (data.posts || []).map((p) => ({
        id: p.id,
        content: p.content,
        mediaType: p.mediaType,
        scheduledAt: p.scheduledAt,
        accountId: p.accountId,
        accountUsername: p.accountUsername,
        accountDisplayName: p.accountDisplayName,
        accountProfilePicture: p.accountProfilePicture,
        status: p.status,
      }));

      setPosts(scheduledPosts);
    } catch {
      setError("予約投稿の読み込みに失敗しました。再度お試しください。");
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/accounts");
      if (response.ok) {
        const data = (await response.json()) as { accounts: Account[] };
        setAccounts(data.accounts || []);
      }
    } catch {
      // Non-critical - account filter just won't be available
    }
  }, []);

  useEffect(() => {
    fetchPosts();
    fetchAccounts();
  }, [fetchPosts, fetchAccounts]);

  const handleAccountChange = useCallback(
    (value: string) => {
      setSelectedAccountId(value);
      fetchPosts(value);
    },
    [fetchPosts]
  );

  const handleRefresh = useCallback(() => {
    fetchPosts(selectedAccountId);
  }, [fetchPosts, selectedAccountId]);

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            スケジュール
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            予約投稿をカレンダーで管理できます。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="更新"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
          <Button asChild>
            <Link href="/posts/new">
              <Plus className="h-4 w-4 mr-2" />
              予約投稿を作成
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      {accounts.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">アカウント:</span>
          <Select
            value={selectedAccountId}
            onValueChange={handleAccountChange}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="すべてのアカウント" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべてのアカウント</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  @{account.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Main Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <CalendarView initialPosts={posts} />
        </div>
      )}
    </div>
  );
}
