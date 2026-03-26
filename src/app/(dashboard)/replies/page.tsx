"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, MessageCircle, Loader2, AlertTriangle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReplyCard, type ReplyItem } from "@/components/replies/reply-card";
import { ReplyStats } from "@/components/replies/reply-stats";
import { PostFilter } from "@/components/replies/post-filter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccountInfo {
  id: string;
  username: string;
  displayName: string | null;
}

type HideStatusFilter = "all" | "visible" | "hidden";
type SortOrder = "newest" | "oldest";

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ReplySkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="animate-pulse space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-muted" />
            <div className="space-y-1.5">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-2/3 bg-muted rounded" />
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="h-3 w-32 bg-muted rounded" />
            <div className="h-7 w-24 bg-muted rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isHiddenStatus(status: string): boolean {
  return status === "HIDDEN" || status === "COVERED";
}

function isTodayTimestamp(timestamp: string): boolean {
  const replyDate = new Date(timestamp);
  const today = new Date();
  return (
    replyDate.getFullYear() === today.getFullYear() &&
    replyDate.getMonth() === today.getMonth() &&
    replyDate.getDate() === today.getDate()
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RepliesPage() {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedPostId, setSelectedPostId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<HideStatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(true);

  // Fetch accounts on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchAccounts() {
      try {
        const response = await fetch("/api/accounts");
        if (!response.ok) throw new Error("Failed to fetch accounts");
        const data = (await response.json()) as {
          accounts: Array<{
            id: string;
            username: string;
            displayName: string | null;
          }>;
        };
        if (!cancelled) {
          setAccounts(data.accounts || []);
          if (data.accounts?.length > 0) {
            setSelectedAccountId(data.accounts[0].id);
          }
        }
      } catch {
        if (!cancelled) {
          setError("アカウント情報の取得に失敗しました");
        }
      } finally {
        if (!cancelled) {
          setAccountsLoading(false);
        }
      }
    }

    fetchAccounts();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch replies when account or post changes
  const fetchReplies = useCallback(
    async (isRefresh = false) => {
      if (!selectedAccountId) return;

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError("");
      setRateLimited(false);

      try {
        const params = new URLSearchParams({ accountId: selectedAccountId });
        if (selectedPostId && selectedPostId !== "all") {
          params.set("postId", selectedPostId);
        }

        const response = await fetch(`/api/replies?${params.toString()}`);
        if (!response.ok) {
          throw new Error("リプライの取得に失敗しました");
        }
        const data = (await response.json()) as {
          replies: ReplyItem[];
          totalCount: number;
          rateLimited: boolean;
        };

        setReplies(data.replies || []);
        setRateLimited(data.rateLimited || false);
      } catch {
        setError("リプライの読み込みに失敗しました。再度お試しください。");
        setReplies([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedAccountId, selectedPostId]
  );

  useEffect(() => {
    if (selectedAccountId) {
      fetchReplies();
    }
  }, [selectedAccountId, selectedPostId, fetchReplies]);

  // Toggle hide/unhide
  const handleToggleHide = useCallback(
    async (replyId: string, hide: boolean) => {
      const response = await fetch(`/api/replies/${replyId}/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hide, accountId: selectedAccountId }),
      });

      if (!response.ok) {
        throw new Error("操作に失敗しました");
      }

      // Update local state
      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId
            ? { ...r, hideStatus: hide ? "HIDDEN" : "NOT_HUSHED" }
            : r
        )
      );
    },
    [selectedAccountId]
  );

  // Filter and sort
  const filteredReplies = replies
    .filter((r) => {
      if (statusFilter === "visible") return !isHiddenStatus(r.hideStatus);
      if (statusFilter === "hidden") return isHiddenStatus(r.hideStatus);
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });

  // Stats
  const totalCount = replies.length;
  const hiddenCount = replies.filter((r) => isHiddenStatus(r.hideStatus)).length;
  const todayCount = replies.filter((r) => isTodayTimestamp(r.timestamp)).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">リプライ管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            投稿へのリプライを確認・管理できます。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Account Selector */}
          <Select
            value={selectedAccountId}
            onValueChange={(v) => {
              setSelectedAccountId(v);
              setSelectedPostId("all");
            }}
            disabled={accountsLoading}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue
                placeholder={accountsLoading ? "読み込み中..." : "アカウント選択"}
              />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  @{a.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchReplies(true)}
            disabled={isLoading || isRefreshing || !selectedAccountId}
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Stats */}
      {!isLoading && selectedAccountId && (
        <ReplyStats total={totalCount} hidden={hiddenCount} today={todayCount} />
      )}

      {/* Rate limit warning */}
      {rateLimited && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            APIのレート制限により、一部のリプライのみ表示されています。しばらく時間をおいてから再度お試しください。
          </span>
        </div>
      )}

      {/* Filter Bar */}
      {selectedAccountId && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Post filter */}
          <PostFilter
            accountId={selectedAccountId}
            value={selectedPostId}
            onChange={setSelectedPostId}
          />

          {/* Status tabs */}
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as HideStatusFilter)}
          >
            <TabsList>
              <TabsTrigger value="all">すべて</TabsTrigger>
              <TabsTrigger value="visible">表示中</TabsTrigger>
              <TabsTrigger value="hidden">非表示</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Sort */}
          <Select
            value={sortOrder}
            onValueChange={(v) => setSortOrder(v as SortOrder)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">新しい順</SelectItem>
              <SelectItem value="oldest">古い順</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      {!selectedAccountId && !accountsLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <MessageCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">
            アカウントを接続してください
          </h3>
          <p className="text-sm text-muted-foreground">
            リプライを管理するには、Threadsアカウントを接続する必要があります。
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <ReplySkeleton key={i} />
          ))}
        </div>
      ) : filteredReplies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <MessageCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">リプライはありません</h3>
          <p className="text-sm text-muted-foreground">
            {statusFilter === "hidden"
              ? "非表示にしたリプライはありません。"
              : statusFilter === "visible"
                ? "表示中のリプライはありません。"
                : "投稿へのリプライはまだありません。"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Reply count */}
          <div className="text-sm text-muted-foreground">
            {filteredReplies.length} 件のリプライ
          </div>

          {/* Reply list */}
          <div className="grid gap-4">
            {filteredReplies.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                onToggleHide={handleToggleHide}
                accountId={selectedAccountId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
