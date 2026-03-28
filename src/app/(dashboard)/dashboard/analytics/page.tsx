"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  Quote,
  MousePointerClick,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/analytics/metric-card";
import { TrendChart } from "@/components/analytics/trend-chart";
import { EngagementDonut } from "@/components/analytics/engagement-donut";
import { MediaComparisonChart } from "@/components/analytics/media-comparison-chart";
import { PostPerformanceTable } from "@/components/analytics/post-performance-table";
import { TimeHeatmap } from "@/components/analytics/time-heatmap";
import { Badge } from "@/components/ui/badge";

// ============================================================================
// Types
// ============================================================================

interface AccountInfo {
  id: string;
  username: string;
  displayName?: string | null;
}

interface OverviewData {
  summary: {
    totalViews: number;
    totalLikes: number;
    totalReplies: number;
    totalReposts: number;
    totalQuotes: number;
    totalClicks: number;
    postsPublished: number;
    avgEngagementRate: number;
  };
  previousSummary: {
    totalViews: number;
    totalLikes: number;
    totalReplies: number;
    totalReposts: number;
    totalQuotes: number;
    totalClicks: number;
    postsPublished: number;
    avgEngagementRate: number;
  };
  dailyTrend: Array<{
    date: string;
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
  }>;
  topPosts: Array<{
    id: string;
    content: string;
    mediaType: string;
    publishedAt: string | null;
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
  }>;
}

interface PostsData {
  posts: Array<{
    id: string;
    content: string;
    mediaType: string;
    publishedAt: string | null;
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
  }>;
  mediaTypeBreakdown: Array<{
    mediaType: string;
    count: number;
    avgViews: number;
    avgLikes: number;
    avgEngagement: number;
  }>;
}

interface EngagementData {
  engagementByType: {
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    shares: number;
  };
  dailyEngagementRate: Array<{
    date: string;
    engagementRate: number;
    views: number;
    likes: number;
    replies: number;
  }>;
  hourlyPerformance: Array<{
    hour: number;
    avgViews: number;
    avgLikes: number;
    avgEngagementRate: number;
    postCount: number;
  }>;
  dailyPerformance: Array<{
    day: number;
    avgViews: number;
    avgLikes: number;
    avgEngagementRate: number;
    postCount: number;
  }>;
  topPosts: Array<{
    id: string;
    content: string;
    mediaType: string;
    publishedAt: string;
    permalink: string | null;
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

type Period = "7d" | "14d" | "30d" | "90d";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "7d", label: "7日間" },
  { value: "14d", label: "14日間" },
  { value: "30d", label: "30日間" },
  { value: "90d", label: "90日間" },
];

// ============================================================================
// Helper
// ============================================================================

function formatNumber(n: number): string {
  return new Intl.NumberFormat("ja-JP").format(n);
}

function formatPercent(n: number): string {
  return `${n.toFixed(2)}%`;
}

// ============================================================================
// Loading skeletons
// ============================================================================

function KpiSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-24 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton({ height = 350 }: { height?: number }) {
  return <Skeleton className="w-full rounded-lg" style={{ height }} />;
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AnalyticsPage() {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [period, setPeriod] = useState<Period>("30d");
  const [activeTab, setActiveTab] = useState("overview");

  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [postsData, setPostsData] = useState<PostsData | null>(null);
  const [engagementData, setEngagementData] = useState<EngagementData | null>(null);

  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingEngagement, setLoadingEngagement] = useState(false);

  // Load accounts
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok) return;
        const data: { accounts?: Array<{ id: string; username: string; displayName?: string | null }> } = await res.json();
        const accs: AccountInfo[] = (data.accounts || []).map(
          (a) => ({
            id: a.id,
            username: a.username,
            displayName: a.displayName,
          })
        );
        setAccounts(accs);
        if (accs.length > 0 && !selectedAccountId) {
          setSelectedAccountId(accs[0]!.id);
        }
      } catch {
        // ignore
      } finally {
        setLoadingAccounts(false);
      }
    }
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch overview data
  const fetchOverview = useCallback(async () => {
    if (!selectedAccountId) return;
    setLoadingOverview(true);
    try {
      const res = await fetch(
        `/api/analytics/overview?accountId=${selectedAccountId}&period=${period}`
      );
      if (!res.ok) throw new Error();
      const data: OverviewData = await res.json();
      setOverviewData(data);
    } catch {
      setOverviewData(null);
    } finally {
      setLoadingOverview(false);
    }
  }, [selectedAccountId, period]);

  // Fetch posts data
  const fetchPosts = useCallback(async () => {
    if (!selectedAccountId) return;
    setLoadingPosts(true);
    try {
      const res = await fetch(
        `/api/analytics/posts?accountId=${selectedAccountId}&period=${period}&limit=50`
      );
      if (!res.ok) throw new Error();
      const data: PostsData = await res.json();
      setPostsData(data);
    } catch {
      setPostsData(null);
    } finally {
      setLoadingPosts(false);
    }
  }, [selectedAccountId, period]);

  // Fetch engagement data
  const fetchEngagement = useCallback(async () => {
    if (!selectedAccountId) return;
    setLoadingEngagement(true);
    try {
      const res = await fetch(
        `/api/analytics/engagement?accountId=${selectedAccountId}&period=${period}`
      );
      if (!res.ok) throw new Error();
      const data: EngagementData = await res.json();
      setEngagementData(data);
    } catch {
      setEngagementData(null);
    } finally {
      setLoadingEngagement(false);
    }
  }, [selectedAccountId, period]);

  // Fetch data when tab/account/period changes
  useEffect(() => {
    if (!selectedAccountId) return;
    if (activeTab === "overview") {
      fetchOverview();
    } else if (activeTab === "posts") {
      fetchPosts();
    } else if (activeTab === "engagement") {
      fetchEngagement();
    }
  }, [activeTab, selectedAccountId, period, fetchOverview, fetchPosts, fetchEngagement]);

  // ============================================================================
  // Render
  // ============================================================================

  if (loadingAccounts) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <KpiSkeleton />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            アナリティクス
          </h2>
          <p className="text-muted-foreground">
            Threadsアカウントを接続すると、パフォーマンスデータが表示されます。
          </p>
        </div>
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">
              アカウントが接続されていません。設定からThreadsアカウントを接続してください。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            アナリティクス
          </h2>
          <p className="text-muted-foreground">
            Threadsのパフォーマンスと成長を追跡します。
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Account selector */}
          {accounts.length > 1 && (
            <Select
              value={selectedAccountId}
              onValueChange={setSelectedAccountId}
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
          <div className="flex rounded-lg border">
            {PERIOD_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={period === opt.value ? "default" : "ghost"}
                size="sm"
                className="rounded-none first:rounded-l-lg last:rounded-r-lg"
                onClick={() => setPeriod(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="posts">投稿</TabsTrigger>
          <TabsTrigger value="engagement">エンゲージメント</TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* Overview Tab                                                     */}
        {/* ================================================================ */}
        <TabsContent value="overview" className="space-y-6">
          {loadingOverview ? (
            <>
              <KpiSkeleton />
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent>
                  <ChartSkeleton />
                </CardContent>
              </Card>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <Skeleton className="h-5 w-36" />
                  </CardHeader>
                  <CardContent>
                    <TableSkeleton />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <Skeleton className="h-5 w-36" />
                  </CardHeader>
                  <CardContent>
                    <ChartSkeleton height={300} />
                  </CardContent>
                </Card>
              </div>
            </>
          ) : overviewData ? (
            <>
              {/* KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard
                  title="閲覧数"
                  value={overviewData.summary.totalViews}
                  previousValue={overviewData.previousSummary.totalViews}
                  icon={Eye}
                />
                <MetricCard
                  title="いいね"
                  value={overviewData.summary.totalLikes}
                  previousValue={overviewData.previousSummary.totalLikes}
                  icon={Heart}
                />
                <MetricCard
                  title="リプライ"
                  value={overviewData.summary.totalReplies}
                  previousValue={overviewData.previousSummary.totalReplies}
                  icon={MessageCircle}
                />
                <MetricCard
                  title="リポスト"
                  value={overviewData.summary.totalReposts}
                  previousValue={overviewData.previousSummary.totalReposts}
                  icon={Repeat2}
                />
                <MetricCard
                  title="引用"
                  value={overviewData.summary.totalQuotes}
                  previousValue={overviewData.previousSummary.totalQuotes}
                  icon={Quote}
                />
                <MetricCard
                  title="クリック数"
                  value={overviewData.summary.totalClicks}
                  previousValue={overviewData.previousSummary.totalClicks}
                  icon={MousePointerClick}
                />
              </div>

              {/* Engagement Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>エンゲージメントトレンド</CardTitle>
                  <CardDescription>
                    選択期間の閲覧数、いいね、リプライの推移
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendChart
                    data={overviewData.dailyTrend}
                    xAxisKey="date"
                    series={[
                      {
                        key: "views",
                        name: "閲覧数",
                        color: "var(--chart-1)",
                      },
                      {
                        key: "likes",
                        name: "いいね",
                        color: "var(--chart-2)",
                      },
                      {
                        key: "replies",
                        name: "リプライ",
                        color: "var(--chart-3)",
                      },
                    ]}
                  />
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Top Performing Posts */}
                <Card>
                  <CardHeader>
                    <CardTitle>トップ投稿</CardTitle>
                    <CardDescription>
                      この期間で最も閲覧数が多い投稿
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {overviewData.topPosts.length === 0 ? (
                      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
                        <p className="text-sm text-muted-foreground">
                          データがありません
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {overviewData.topPosts.slice(0, 5).map((post, index) => (
                          <div
                            key={post.id}
                            className="flex items-start gap-3 rounded-lg border p-3"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                              {index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">
                                {post.content.slice(0, 80)}
                                {post.content.length > 80 ? "..." : ""}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span>
                                  {formatNumber(post.metrics.views)} 閲覧
                                </span>
                                <span>
                                  {formatNumber(post.metrics.likes)} いいね
                                </span>
                                <span>
                                  {formatNumber(post.metrics.replies)} リプライ
                                </span>
                                <span>
                                  {formatPercent(post.engagementRate)} Eng率
                                </span>
                              </div>
                            </div>
                            {post.permalink && (
                              <a
                                href={post.permalink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Engagement Breakdown Donut */}
                <Card>
                  <CardHeader>
                    <CardTitle>エンゲージメント内訳</CardTitle>
                    <CardDescription>
                      いいね、リプライ、リポスト、引用の割合
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EngagementDonut
                      data={{
                        likes: overviewData.summary.totalLikes,
                        replies: overviewData.summary.totalReplies,
                        reposts: overviewData.summary.totalReposts,
                        quotes: overviewData.summary.totalQuotes,
                      }}
                    />
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="flex h-64 items-center justify-center">
                <p className="text-muted-foreground">
                  データの取得に失敗しました。
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* Posts Tab                                                        */}
        {/* ================================================================ */}
        <TabsContent value="posts" className="space-y-6">
          {loadingPosts ? (
            <>
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-72" />
                </CardHeader>
                <CardContent>
                  <TableSkeleton />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent>
                  <ChartSkeleton />
                </CardContent>
              </Card>
            </>
          ) : postsData ? (
            <>
              {/* Post Performance Table */}
              <Card>
                <CardHeader>
                  <CardTitle>投稿パフォーマンス</CardTitle>
                  <CardDescription>
                    選択期間に公開された各投稿の詳細指標。ヘッダーをクリックしてソートできます。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PostPerformanceTable posts={postsData.posts} />
                </CardContent>
              </Card>

              {/* Media Type Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle>メディアタイプ比較</CardTitle>
                  <CardDescription>
                    各メディアタイプごとの平均パフォーマンス
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MediaComparisonChart data={postsData.mediaTypeBreakdown} />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex h-64 items-center justify-center">
                <p className="text-muted-foreground">
                  データの取得に失敗しました。
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* Engagement Tab                                                   */}
        {/* ================================================================ */}
        <TabsContent value="engagement" className="space-y-6">
          {loadingEngagement ? (
            <>
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent>
                  <ChartSkeleton />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent>
                  <ChartSkeleton height={300} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent>
                  <TableSkeleton />
                </CardContent>
              </Card>
            </>
          ) : engagementData ? (
            <>
              {/* Engagement Rate Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>エンゲージメント率の推移</CardTitle>
                  <CardDescription>
                    日別のエンゲージメント率トレンド
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendChart
                    data={engagementData.dailyEngagementRate}
                    xAxisKey="date"
                    series={[
                      {
                        key: "engagementRate",
                        name: "エンゲージメント率 (%)",
                        color: "var(--chart-1)",
                      },
                    ]}
                  />
                </CardContent>
              </Card>

              {/* Best Time to Post Heatmap */}
              <Card>
                <CardHeader>
                  <CardTitle>最適な投稿時間帯</CardTitle>
                  <CardDescription>
                    曜日と時間帯ごとの平均エンゲージメント率。色が濃いほどパフォーマンスが高い時間帯です。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TimeHeatmap
                    hourlyPerformance={engagementData.hourlyPerformance}
                    dailyPerformance={engagementData.dailyPerformance}
                  />
                </CardContent>
              </Card>

              {/* Top Posts by Engagement */}
              <Card>
                <CardHeader>
                  <CardTitle>エンゲージメント率トップ投稿</CardTitle>
                  <CardDescription>
                    エンゲージメント率が最も高い投稿
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {engagementData.topPosts.length === 0 ? (
                    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
                      <p className="text-sm text-muted-foreground">
                        データがありません
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {engagementData.topPosts.map((post, index) => (
                        <div
                          key={post.id}
                          className="flex items-start gap-3 rounded-lg border p-3"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">
                              {post.content.slice(0, 80)}
                              {post.content.length > 80 ? "..." : ""}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {formatPercent(post.engagementRate)} Eng率
                              </Badge>
                              <span>
                                {formatNumber(post.metrics.views)} 閲覧
                              </span>
                              <span>
                                {formatNumber(post.metrics.likes)} いいね
                              </span>
                              <span>
                                {formatNumber(post.metrics.replies)} リプライ
                              </span>
                              <span>
                                {formatNumber(post.metrics.reposts)} リポスト
                              </span>
                            </div>
                          </div>
                          {post.permalink && (
                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex h-64 items-center justify-center">
                <p className="text-muted-foreground">
                  データの取得に失敗しました。
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
