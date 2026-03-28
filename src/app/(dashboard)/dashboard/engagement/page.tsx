"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  Heart,
  MessageCircle,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EngagementRateChart } from "@/components/analytics/engagement-rate-chart";
import { EngagementBreakdown } from "@/components/analytics/engagement-breakdown";
import { PostingTimeHeatmap } from "@/components/analytics/posting-time-heatmap";
import { MediaTypeChart } from "@/components/analytics/media-type-chart";
import { TopPostsList } from "@/components/analytics/top-posts-list";

// ---- Types ----

interface EngagementByType {
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}

interface DailyRate {
  date: string;
  engagementRate: number;
  views: number;
  likes: number;
  replies: number;
}

interface HourlyPerf {
  hour: number;
  postCount: number;
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
  avgEngagementRate: number;
}

interface DailyPerf {
  day: number;
  postCount: number;
  avgViews: number;
  avgLikes: number;
  avgEngagementRate: number;
}

interface MediaPerf {
  mediaType: string;
  postCount: number;
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
  avgReposts: number;
  avgEngagementRate: number;
}

interface TopPost {
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
}

interface EngagementData {
  engagementByType: EngagementByType;
  dailyEngagementRate: DailyRate[];
  hourlyPerformance: HourlyPerf[];
  dailyPerformance: DailyPerf[];
  mediaTypePerformance: MediaPerf[];
  topPosts: TopPost[];
}

interface Account {
  id: string;
  username: string;
}

// ---- Period options ----

const PERIODS = [
  { value: "7d", label: "7日間" },
  { value: "30d", label: "30日間" },
  { value: "90d", label: "90日間" },
] as const;

// ---- Number formatting ----

const numberFormatter = new Intl.NumberFormat("ja-JP");

// ---- Component ----

export default function EngagementPage() {
  const [data, setData] = useState<EngagementData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [period, setPeriod] = useState<string>("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts on mount
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("/api/accounts");
        if (res.ok) {
          const json = await res.json() as { accounts?: Array<{ id: string; username: string }> };
          const accs: Account[] = (json.accounts ?? []).map(
            (a: { id: string; username: string }) => ({
              id: a.id,
              username: a.username,
            })
          );
          setAccounts(accs);
          if (accs.length > 0 && !selectedAccount) {
            setSelectedAccount(accs[0]!.id);
          }
        }
      } catch {
        // Accounts fetch failure is non-fatal
      }
    }
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedAccount) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        accountId: selectedAccount,
        period,
      });
      const res = await fetch(`/api/analytics/engagement?${params}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errJson.error || "データの取得に失敗しました");
      }
      const json: EngagementData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, period]);

  useEffect(() => {
    if (selectedAccount) {
      fetchData();
    }
  }, [fetchData, selectedAccount]);

  // Computed KPIs
  const avgEngagementRate =
    data && data.dailyEngagementRate.length > 0
      ? Math.round(
          (data.dailyEngagementRate.reduce(
            (sum, d) => sum + d.engagementRate,
            0
          ) /
            data.dailyEngagementRate.length) *
            100
        ) / 100
      : 0;

  const totalPosts = data
    ? data.topPosts.length
    : 0;

  const avgLikesPerPost =
    data && totalPosts > 0
      ? Math.round(
          data.topPosts.reduce((sum, p) => sum + p.metrics.likes, 0) /
            totalPosts
        )
      : 0;

  const avgRepliesPerPost =
    data && totalPosts > 0
      ? Math.round(
          data.topPosts.reduce((sum, p) => sum + p.metrics.replies, 0) /
            totalPosts
        )
      : 0;

  const totalEngagement = data
    ? data.engagementByType.likes +
      data.engagementByType.replies +
      data.engagementByType.reposts +
      data.engagementByType.quotes +
      data.engagementByType.shares
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            エンゲージメント分析
          </h2>
          <p className="text-muted-foreground">
            エンゲージメント率の推移、投稿時間帯分析、メディアタイプ比較
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Account selector */}
          {accounts.length > 1 && (
            <Select
              value={selectedAccount}
              onValueChange={setSelectedAccount}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="アカウント選択" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    @{acc.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Period selector */}
          <div className="flex rounded-md border border-input">
            {PERIODS.map((p) => (
              <Button
                key={p.value}
                variant={period === p.value ? "default" : "ghost"}
                size="sm"
                className="rounded-none first:rounded-l-md last:rounded-r-md"
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* KPI Row */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="平均エンゲージメント率"
            value={`${avgEngagementRate}%`}
            icon={Activity}
          />
          <KpiCard
            title="平均いいね/投稿"
            value={numberFormatter.format(avgLikesPerPost)}
            icon={Heart}
          />
          <KpiCard
            title="平均リプライ/投稿"
            value={numberFormatter.format(avgRepliesPerPost)}
            icon={MessageCircle}
          />
          <KpiCard
            title="合計エンゲージメント"
            value={numberFormatter.format(totalEngagement)}
            icon={Zap}
          />
        </div>
      )}

      {/* Engagement Rate Trend */}
      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>エンゲージメント率推移</CardTitle>
            <CardDescription>
              日別のエンゲージメント率（いいね+リプライ+リポスト+引用 / 閲覧数）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EngagementRateChart data={data?.dailyEngagementRate ?? []} />
          </CardContent>
        </Card>
      )}

      {/* Breakdown Donut + Best Time Heatmap */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Engagement Breakdown */}
        {loading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>エンゲージメント内訳</CardTitle>
              <CardDescription>
                いいね / リプライ / リポスト / 引用 / シェアの割合
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EngagementBreakdown
                data={
                  data?.engagementByType ?? {
                    likes: 0,
                    replies: 0,
                    reposts: 0,
                    quotes: 0,
                    shares: 0,
                  }
                }
              />
            </CardContent>
          </Card>
        )}

        {/* Best Time Heatmap */}
        {loading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>最適な投稿時間帯</CardTitle>
              <CardDescription>
                曜日 x 時間帯別のエンゲージメント率ヒートマップ
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PostingTimeHeatmap
                hourlyData={
                  data?.hourlyPerformance?.map((h) => ({
                    hour: h.hour,
                    postCount: h.postCount,
                    avgEngagementRate: h.avgEngagementRate,
                  })) ?? []
                }
                dailyData={
                  data?.dailyPerformance?.map((d) => ({
                    day: d.day,
                    postCount: d.postCount,
                    avgEngagementRate: d.avgEngagementRate,
                  })) ?? []
                }
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Media Type Comparison */}
      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>メディアタイプ比較</CardTitle>
            <CardDescription>
              テキスト / 画像 / 動画 / カルーセルごとの平均パフォーマンス
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MediaTypeChart
              data={
                data?.mediaTypePerformance?.map((m) => ({
                  mediaType: m.mediaType,
                  postCount: m.postCount,
                  avgViews: m.avgViews,
                  avgLikes: m.avgLikes,
                  avgEngagementRate: m.avgEngagementRate,
                })) ?? []
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Top Engaging Posts */}
      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>トップエンゲージメント投稿</CardTitle>
            <CardDescription>
              エンゲージメント率が高い上位10投稿
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TopPostsList posts={data?.topPosts ?? []} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---- Internal KPI Card ----

function KpiCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
