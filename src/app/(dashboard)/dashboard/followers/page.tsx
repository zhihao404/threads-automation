"use client";

import { useCallback, useEffect, useState } from "react";
import { Info, TrendingDown, TrendingUp, Users } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { FollowerGrowthChart } from "@/components/analytics/follower-growth-chart";
import { DailyChangeChart } from "@/components/analytics/daily-change-chart";
import { DemographicsChart } from "@/components/analytics/demographics-chart";
import { GrowthContributorCard } from "@/components/analytics/growth-contributor-card";

// ============================================================================
// Types
// ============================================================================

interface Account {
  id: string;
  username: string;
  displayName: string | null;
}

interface FollowerData {
  current: number;
  change: number;
  changePercent: number;
  dailyGrowth: Array<{ date: string; followers: number; change: number }>;
  growthContributors: Array<{
    postId: string;
    content: string;
    publishedAt: string;
    followersBefore: number;
    followersAfter: number;
    gain: number;
  }>;
}

interface DemographicItem {
  label: string;
  value: number;
  percentage: number;
}

interface DemographicsData {
  type: string;
  data: DemographicItem[];
  totalCount: number;
}

type DemographicType = "country" | "city" | "age" | "gender";

// ============================================================================
// Component
// ============================================================================

export default function FollowersPage() {
  // State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [period, setPeriod] = useState<string>("30d");
  const [followerData, setFollowerData] = useState<FollowerData | null>(null);
  const [demographicsData, setDemographicsData] =
    useState<DemographicsData | null>(null);
  const [demographicType, setDemographicType] =
    useState<DemographicType>("country");
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingFollowers, setIsLoadingFollowers] = useState(false);
  const [isLoadingDemographics, setIsLoadingDemographics] = useState(false);
  const [demographicsError, setDemographicsError] = useState<string | null>(
    null
  );
  const [insufficientFollowers, setInsufficientFollowers] = useState(false);

  // Fetch accounts
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok) return;
        const data: { accounts?: Account[] } = await res.json();
        const accountList: Account[] = data.accounts || [];
        setAccounts(accountList);
        if (accountList.length > 0 && !selectedAccountId) {
          setSelectedAccountId(accountList[0].id);
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoadingAccounts(false);
      }
    }
    fetchAccounts();
  }, [selectedAccountId]);

  // Fetch follower data
  const fetchFollowerData = useCallback(async () => {
    if (!selectedAccountId) return;

    setIsLoadingFollowers(true);
    try {
      const res = await fetch(
        `/api/analytics/followers?accountId=${selectedAccountId}&period=${period}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data: FollowerData = await res.json();
      setFollowerData(data);
    } catch {
      setFollowerData(null);
    } finally {
      setIsLoadingFollowers(false);
    }
  }, [selectedAccountId, period]);

  useEffect(() => {
    fetchFollowerData();
  }, [fetchFollowerData]);

  // Fetch demographics
  const fetchDemographics = useCallback(async () => {
    if (!selectedAccountId) return;

    setIsLoadingDemographics(true);
    setDemographicsError(null);
    setInsufficientFollowers(false);

    try {
      const res = await fetch(
        `/api/analytics/demographics?accountId=${selectedAccountId}&type=${demographicType}`
      );

      if (!res.ok) {
        const errorData: { code?: string; error?: string } = await res.json();
        if (errorData.code === "INSUFFICIENT_FOLLOWERS") {
          setInsufficientFollowers(true);
          setDemographicsData(null);
          return;
        }
        throw new Error(errorData.error || "Failed to fetch");
      }

      const data: DemographicsData = await res.json();
      setDemographicsData(data);
    } catch (err) {
      setDemographicsError(
        err instanceof Error
          ? err.message
          : "デモグラフィクスの取得に失敗しました"
      );
      setDemographicsData(null);
    } finally {
      setIsLoadingDemographics(false);
    }
  }, [selectedAccountId, demographicType]);

  useEffect(() => {
    fetchDemographics();
  }, [fetchDemographics]);

  // Computed values
  const dailyAverage =
    followerData && followerData.dailyGrowth.length > 1
      ? Math.round(
          (followerData.change / (followerData.dailyGrowth.length - 1)) * 100
        ) / 100
      : 0;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            フォロワー分析
          </h2>
          <p className="text-muted-foreground">
            フォロワーの増減推移とデモグラフィクスを確認できます。
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Account Selector */}
          {isLoadingAccounts ? (
            <Skeleton className="h-9 w-40" />
          ) : (
            <Select
              value={selectedAccountId}
              onValueChange={setSelectedAccountId}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="アカウント選択" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    @{account.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Period Selector */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7日間</SelectItem>
              <SelectItem value="30d">30日間</SelectItem>
              <SelectItem value="90d">90日間</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* No account selected */}
      {!isLoadingAccounts && accounts.length === 0 && (
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <div className="text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-lg font-medium">
                アカウントが接続されていません
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                まずThreadsアカウントを接続してください。
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      {selectedAccountId && (
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Current Followers */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>現在のフォロワー数</CardDescription>
              {isLoadingFollowers ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <CardTitle className="text-2xl">
                  {followerData
                    ? followerData.current.toLocaleString()
                    : "-"}
                </CardTitle>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                最新のデータに基づく
              </p>
            </CardContent>
          </Card>

          {/* Period Change */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>期間内の増減</CardDescription>
              {isLoadingFollowers ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <span
                    className={
                      followerData && followerData.change > 0
                        ? "text-emerald-600"
                        : followerData && followerData.change < 0
                          ? "text-red-500"
                          : ""
                    }
                  >
                    {followerData
                      ? `${followerData.change > 0 ? "+" : ""}${followerData.change.toLocaleString()}`
                      : "-"}
                  </span>
                  {followerData && followerData.change > 0 && (
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  )}
                  {followerData && followerData.change < 0 && (
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  )}
                </CardTitle>
              )}
            </CardHeader>
            <CardContent>
              {isLoadingFollowers ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {followerData
                    ? `${followerData.changePercent > 0 ? "+" : ""}${followerData.changePercent}%`
                    : "-"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Daily Average */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>1日あたりの平均増減</CardDescription>
              {isLoadingFollowers ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <CardTitle className="text-2xl">
                  <span
                    className={
                      dailyAverage > 0
                        ? "text-emerald-600"
                        : dailyAverage < 0
                          ? "text-red-500"
                          : ""
                    }
                  >
                    {followerData
                      ? `${dailyAverage > 0 ? "+" : ""}${dailyAverage}`
                      : "-"}
                  </span>
                </CardTitle>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                選択期間の平均値
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Follower Growth Chart */}
      {selectedAccountId && (
        <Card>
          <CardHeader>
            <CardTitle>フォロワー推移</CardTitle>
            <CardDescription>
              選択期間のフォロワー数の推移を表示します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingFollowers ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <FollowerGrowthChart
                data={followerData?.dailyGrowth ?? []}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Daily Change Chart */}
      {selectedAccountId && (
        <Card>
          <CardHeader>
            <CardTitle>日次増減</CardTitle>
            <CardDescription>
              1日ごとのフォロワー増減を表示します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingFollowers ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <DailyChangeChart
                data={followerData?.dailyGrowth ?? []}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Growth Contributors */}
      {selectedAccountId && (
        <Card>
          <CardHeader>
            <CardTitle>フォロワー増加に貢献した投稿</CardTitle>
            <CardDescription>
              投稿日前後のフォロワー増加数が大きい投稿を表示します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingFollowers ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : followerData &&
              followerData.growthContributors.length > 0 ? (
              <div className="space-y-3">
                {followerData.growthContributors.map((contributor) => (
                  <GrowthContributorCard
                    key={contributor.postId}
                    postId={contributor.postId}
                    content={contributor.content}
                    publishedAt={contributor.publishedAt}
                    gain={contributor.gain}
                    followersBefore={contributor.followersBefore}
                    followersAfter={contributor.followersAfter}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  該当期間にフォロワー増加に貢献した投稿はありません。
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Demographics Section */}
      {selectedAccountId && (
        <Card>
          <CardHeader>
            <CardTitle>フォロワー属性</CardTitle>
            <CardDescription>
              フォロワーの国・都市・年齢・性別の内訳を確認できます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {insufficientFollowers ? (
              <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/50">
                <Info className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  フォロワー属性データは100フォロワー以上で利用可能です。フォロワーが増えると自動的に表示されます。
                </p>
              </div>
            ) : (
              <Tabs
                value={demographicType}
                onValueChange={(value) =>
                  setDemographicType(value as DemographicType)
                }
              >
                <TabsList className="mb-4">
                  <TabsTrigger value="country">国</TabsTrigger>
                  <TabsTrigger value="city">都市</TabsTrigger>
                  <TabsTrigger value="age">年齢</TabsTrigger>
                  <TabsTrigger value="gender">性別</TabsTrigger>
                </TabsList>

                <TabsContent value={demographicType}>
                  {isLoadingDemographics ? (
                    <Skeleton className="h-72 w-full" />
                  ) : demographicsError ? (
                    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
                      <p className="text-sm text-muted-foreground">
                        {demographicsError}
                      </p>
                    </div>
                  ) : demographicsData && demographicsData.data.length > 0 ? (
                    <div>
                      <DemographicsChart
                        type={demographicType}
                        data={demographicsData.data}
                      />
                      <p className="mt-2 text-right text-xs text-muted-foreground">
                        合計: {demographicsData.totalCount.toLocaleString()}人
                      </p>
                    </div>
                  ) : (
                    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
                      <p className="text-sm text-muted-foreground">
                        データがありません
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
