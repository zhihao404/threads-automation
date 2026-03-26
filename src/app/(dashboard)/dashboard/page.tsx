"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Eye,
  Heart,
  MessageCircle,
  Users,
  Plus,
  Calendar,
  BarChart3,
  Sparkles,
  AlertCircle,
  LinkIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EngagementChart } from "@/components/dashboard/engagement-chart";
import { PostStatusChart } from "@/components/dashboard/post-status-chart";
import { RecentPostsList } from "@/components/dashboard/recent-posts-list";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccountInfo {
  id: string;
  username: string;
  displayName: string | null;
  profilePictureUrl: string | null;
}

interface KpiMetric {
  current: number;
  previous: number;
  change: number;
}

interface DashboardData {
  accounts: AccountInfo[];
  kpi: {
    views: KpiMetric;
    likes: KpiMetric;
    replies: KpiMetric;
    followers: { current: number; change: number };
  };
  recentPosts: Array<{
    id: string;
    content: string;
    status: string;
    mediaType: string;
    publishedAt: string | null;
    createdAt: string;
    metrics: { views: number; likes: number; replies: number } | null;
  }>;
  dailyMetrics: Array<{
    date: string;
    views: number;
    likes: number;
    replies: number;
    reposts: number;
  }>;
  postsByStatus: {
    published: number;
    scheduled: number;
    draft: number;
    failed: number;
  };
}

type Period = "7d" | "14d" | "30d" | "90d";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "7d", label: "7日間" },
  { value: "14d", label: "14日間" },
  { value: "30d", label: "30日間" },
  { value: "90d", label: "90日間" },
];

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
              <Skeleton className="mt-2 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-[380px] w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[360px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[360px] rounded-xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state: no accounts connected
// ---------------------------------------------------------------------------

function NoAccountsState() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ダッシュボード</h2>
        <p className="text-muted-foreground">
          Threadsアカウントを接続して始めましょう
        </p>
      </div>
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <div className="rounded-full bg-muted p-4">
            <LinkIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              アカウントが接続されていません
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Threadsアカウントを接続して、投稿の管理やパフォーマンスの分析を始めましょう。
            </p>
          </div>
          <Button asChild>
            <Link href="/accounts">アカウントを接続する</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ダッシュボード</h2>
      </div>
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">エラーが発生しました</h3>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
          <Button onClick={onRetry}>再読み込み</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("7d");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period });
      if (selectedAccountId !== "all") {
        params.set("accountId", selectedAccountId);
      }
      const res = await fetch(`/api/analytics/dashboard?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(
          body?.error || `サーバーエラー (${res.status})`
        );
      }
      const json: DashboardData = await res.json();
      setData(json);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "データの取得に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }, [period, selectedAccountId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Loading
  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  // Error (no data at all)
  if (error && !data) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  // No accounts
  if (data && data.accounts.length === 0) {
    return <NoAccountsState />;
  }

  if (!data) return null;

  const followersChange =
    data.kpi.followers.current > 0 && data.kpi.followers.change !== 0
      ? Math.round(
          (data.kpi.followers.change /
            (data.kpi.followers.current - data.kpi.followers.change)) *
            1000
        ) / 10
      : 0;

  return (
    <div className="space-y-6">
      {/* Header with selectors */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">ダッシュボード</h2>
          <p className="text-muted-foreground">
            Threadsのパフォーマンス概要
          </p>
        </div>
        <div className="flex gap-2">
          {data.accounts.length > 1 && (
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="アカウント選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべてのアカウント</SelectItem>
                {data.accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    @{acc.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="閲覧数"
          value={data.kpi.views.current}
          previousValue={data.kpi.views.previous}
          change={data.kpi.views.change}
          icon={Eye}
          format="compact"
        />
        <KpiCard
          title="いいね"
          value={data.kpi.likes.current}
          previousValue={data.kpi.likes.previous}
          change={data.kpi.likes.change}
          icon={Heart}
        />
        <KpiCard
          title="リプライ"
          value={data.kpi.replies.current}
          previousValue={data.kpi.replies.previous}
          change={data.kpi.replies.change}
          icon={MessageCircle}
        />
        <KpiCard
          title="フォロワー"
          value={data.kpi.followers.current}
          change={followersChange}
          icon={Users}
        />
      </div>

      {/* Engagement Chart */}
      <EngagementChart data={data.dailyMetrics} period={period} />

      {/* Recent Posts + Quick Actions / Status Chart */}
      <div className="grid gap-6 lg:grid-cols-3">
        <RecentPostsList posts={data.recentPosts} />

        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>クイックアクション</CardTitle>
              <CardDescription>よく使う操作</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button asChild className="w-full justify-start gap-2">
                <Link href="/posts/new">
                  <Plus className="h-4 w-4" />
                  新規投稿
                </Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="w-full justify-start gap-2"
              >
                <Link href="/posts/schedule">
                  <Calendar className="h-4 w-4" />
                  投稿をスケジュール
                </Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="w-full justify-start gap-2"
              >
                <Link href="/dashboard/analytics">
                  <BarChart3 className="h-4 w-4" />
                  分析を見る
                </Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="w-full justify-start gap-2"
              >
                <Link href="/ai/generate">
                  <Sparkles className="h-4 w-4" />
                  AIで生成
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Post Status Distribution */}
          <PostStatusChart data={data.postsByStatus} />
        </div>
      </div>
    </div>
  );
}
