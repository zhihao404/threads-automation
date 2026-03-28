"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Eye,
  Heart,
  Users,
  CheckCircle2,
  Lightbulb,
  Clock,
  Tag,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { InsightsHeatmap } from "@/components/ai/insights-heatmap";
import { cn } from "@/lib/utils";
import type { InsightResult, AccountOverview } from "@/lib/ai/insights";

interface ThreadsAccount {
  id: string;
  username: string;
  displayName: string | null;
}

export default function AIInsightsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<InsightResult | null>(null);
  const [accountData, setAccountData] = useState<AccountOverview | null>(null);

  // Fetch accounts
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok) throw new Error("アカウントの取得に失敗しました");
        const data = (await res.json()) as { accounts?: ThreadsAccount[] };
        setAccounts(data.accounts || []);
        if (data.accounts && data.accounts.length > 0) {
          setSelectedAccountId(data.accounts[0]!.id);
        }
      } catch {
        setError("アカウントの取得に失敗しました");
      } finally {
        setLoadingAccounts(false);
      }
    }
    fetchAccounts();
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedAccountId) return;

    setLoading(true);
    setError(null);
    setInsights(null);
    setAccountData(null);

    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selectedAccountId, period }),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as { error?: string };
        throw new Error(errorData.error || "インサイトの生成に失敗しました");
      }

      const data = (await res.json()) as { insights: InsightResult; accountData: AccountOverview };
      setInsights(data.insights);
      setAccountData(data.accountData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "インサイトの生成に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, period]);

  // Build heatmap data from accountData
  const heatmapData: Record<string, number> = {};
  if (accountData) {
    // Distribute posting activity as a baseline heatmap
    for (const [hour, count] of Object.entries(accountData.postsByHour)) {
      for (let day = 0; day < 7; day++) {
        const dayCount = accountData.postsByDay[day] || 0;
        heatmapData[`${hour}-${day}`] = count + dayCount;
      }
    }
  }

  const periodLabel =
    period === "7d" ? "7日間" : period === "90d" ? "90日間" : "30日間";

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            AI インサイト
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AIがアカウントのパフォーマンスを分析し、改善提案を生成します
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Account selector */}
          <Select
            value={selectedAccountId}
            onValueChange={setSelectedAccountId}
            disabled={loadingAccounts}
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

          {/* Period selector */}
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as "7d" | "30d" | "90d")}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7日間</SelectItem>
              <SelectItem value="30d">30日間</SelectItem>
              <SelectItem value="90d">90日間</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleGenerate}
            disabled={loading || !selectedAccountId}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {loading ? "分析中..." : "インサイト生成"}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={loading}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              再試行
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center gap-3 py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  AIがデータを分析しています...
                </p>
              </div>
            </CardContent>
          </Card>
          {/* Skeleton cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded animate-pulse w-1/2 mb-3" />
                  <div className="h-8 bg-muted rounded animate-pulse w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded animate-pulse w-1/3 mb-4" />
                  <div className="space-y-2">
                    {[1, 2, 3].map((j) => (
                      <div
                        key={j}
                        className="h-12 bg-muted rounded animate-pulse"
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* No accounts */}
      {!loadingAccounts && accounts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">
              Threadsアカウントが未接続です
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              インサイトを生成するには、まずアカウントを接続してください
            </p>
            <Button
              variant="outline"
              onClick={() => router.push("/accounts")}
            >
              アカウント設定へ
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {insights && accountData && !loading && (
        <div className="flex flex-col gap-6">
          {/* Performance Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                パフォーマンスサマリー（{periodLabel}）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 mb-6">
                <p className="text-sm leading-relaxed">{insights.summary}</p>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">平均閲覧数</p>
                    <p className="text-lg font-bold">
                      {accountData.avgViews.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                    <Heart className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      平均いいね数
                    </p>
                    <p className="text-lg font-bold">
                      {accountData.avgLikes.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      フォロワー数
                    </p>
                    <p className="text-lg font-bold">
                      {accountData.followersCount.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    {accountData.followersTrend >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      フォロワー増減
                    </p>
                    <p
                      className={cn(
                        "text-lg font-bold",
                        accountData.followersTrend >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      )}
                    >
                      {accountData.followersTrend > 0 ? "+" : ""}
                      {accountData.followersTrend.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Strengths & Improvements */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Strengths */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  強み
                </CardTitle>
                <CardDescription>
                  うまくいっているポイント
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {insights.strengths.map((strength, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/10 p-3"
                    >
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
                      <p className="text-sm">{strength}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Improvements */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Lightbulb className="h-5 w-5" />
                  改善点
                </CardTitle>
                <CardDescription>
                  改善できるポイント
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {insights.improvements.map((improvement, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 p-3"
                    >
                      <Lightbulb className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <p className="text-sm">{improvement}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Best Posting Times */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                おすすめ投稿時間
              </CardTitle>
              <CardDescription>
                パフォーマンスデータに基づく最適な投稿タイミング
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InsightsHeatmap
                data={heatmapData}
                bestTimes={insights.bestTimes.map((bt) => ({
                  hour: bt.hour,
                  day: bt.day,
                }))}
              />

              <Separator className="my-4" />

              <div className="flex flex-col gap-2">
                {insights.bestTimes.map((bt, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg bg-muted/50 p-3"
                  >
                    <Badge variant="outline" className="shrink-0 font-mono">
                      {bt.day} {bt.hour}:00
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {bt.reason}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Content Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                コンテンツ戦略のヒント
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {insights.contentTips.map((tip, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm">{tip}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Suggested Topics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                おすすめトピック
              </CardTitle>
              <CardDescription>
                クリックしてAI生成ページにトピックを設定
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {insights.suggestedTopics.map((topic, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="cursor-pointer text-sm px-3 py-1.5 hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => {
                      router.push(
                        `/ai/generate?topic=${encodeURIComponent(topic)}`
                      );
                    }}
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state after load */}
      {!insights && !loading && !error && accounts.length > 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <Brain className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">
              AI インサイトを生成しましょう
            </p>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
              アカウントと期間を選択して「インサイト生成」をクリックすると、
              AIがパフォーマンスデータを分析し、改善提案を生成します。
            </p>
            <Button onClick={handleGenerate} disabled={!selectedAccountId}>
              <Sparkles className="h-4 w-4 mr-2" />
              インサイト生成
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
