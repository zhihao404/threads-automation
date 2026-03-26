"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  CalendarDays,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
  CalendarPlus,
  Users,
  Settings2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarSuggestionCard } from "@/components/ai/calendar-suggestion-card";
import { cn } from "@/lib/utils";
import type { CalendarSuggestion } from "@/lib/ai/calendar";

interface ThreadsAccount {
  id: string;
  username: string;
  displayName: string | null;
}

type ToneType =
  | "casual"
  | "professional"
  | "humorous"
  | "informative"
  | "inspiring"
  | "provocative";

const toneOptions: { value: ToneType; label: string }[] = [
  { value: "casual", label: "カジュアル" },
  { value: "professional", label: "プロフェッショナル" },
  { value: "humorous", label: "ユーモラス" },
  { value: "informative", label: "情報提供" },
  { value: "inspiring", label: "インスピレーション" },
  { value: "provocative", label: "刺激的" },
];

export default function AICalendarPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Generator params
  const [period, setPeriod] = useState<"week" | "2weeks" | "month">("week");
  const [postsPerDay, setPostsPerDay] = useState<string>("1");
  const [topicsInput, setTopicsInput] = useState("");
  const [tone, setTone] = useState<ToneType>("casual");
  const [showSettings, setShowSettings] = useState(true);

  // Results
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CalendarSuggestion[]>([]);
  const [skippedIndices, setSkippedIndices] = useState<Set<number>>(
    new Set()
  );
  const [scheduledIndices, setScheduledIndices] = useState<Set<number>>(
    new Set()
  );

  // Fetch accounts
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok) throw new Error("アカウントの取得に失敗しました");
        const data = (await res.json()) as { accounts?: ThreadsAccount[] };
        setAccounts(data.accounts || []);
        if (data.accounts && data.accounts.length > 0) {
          setSelectedAccountId(data.accounts[0].id);
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
    setLoading(true);
    setError(null);
    setSuggestions([]);
    setSkippedIndices(new Set());
    setScheduledIndices(new Set());

    try {
      const topics = topicsInput
        .split(/[,、]/)
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/ai/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId || undefined,
          period,
          postsPerDay: parseInt(postsPerDay),
          topics: topics.length > 0 ? topics : undefined,
          tone,
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as { error?: string };
        throw new Error(
          errorData.error || "カレンダーの生成に失敗しました"
        );
      }

      const data = (await res.json()) as { suggestions?: CalendarSuggestion[] };
      setSuggestions(data.suggestions || []);
      setShowSettings(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "カレンダーの生成に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, period, postsPerDay, topicsInput, tone]);

  const handleSchedulePost = async (
    index: number,
    content: string,
    topicTag?: string
  ) => {
    if (!selectedAccountId) {
      setError("投稿を予約するにはアカウントを選択してください");
      return;
    }

    const suggestion = suggestions[index];
    const scheduledAt = `${suggestion.date}T${suggestion.time}:00`;

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          content,
          mediaType: "TEXT",
          topicTag: topicTag || undefined,
          status: "scheduled",
          scheduledAt,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "予約に失敗しました");
      }

      setScheduledIndices((prev) => new Set([...prev, index]));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "予約に失敗しました"
      );
    }
  };

  const handleScheduleAll = async () => {
    if (!selectedAccountId) {
      setError("投稿を予約するにはアカウントを選択してください");
      return;
    }

    for (let i = 0; i < suggestions.length; i++) {
      if (skippedIndices.has(i) || scheduledIndices.has(i)) continue;
      await handleSchedulePost(
        i,
        suggestions[i].content,
        suggestions[i].topicTag
      );
    }
  };

  // Group suggestions by date
  const suggestionsByDate: Record<string, { index: number; suggestion: CalendarSuggestion }[]> = {};
  suggestions.forEach((suggestion, index) => {
    if (!suggestionsByDate[suggestion.date]) {
      suggestionsByDate[suggestion.date] = [];
    }
    suggestionsByDate[suggestion.date].push({ index, suggestion });
  });

  const sortedDates = Object.keys(suggestionsByDate).sort();

  const periodLabel =
    period === "week"
      ? "1週間"
      : period === "2weeks"
        ? "2週間"
        : "1ヶ月";

  const activeCount = suggestions.filter(
    (_, i) => !skippedIndices.has(i) && !scheduledIndices.has(i)
  ).length;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            コンテンツカレンダー
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AIが最適な投稿スケジュールとコンテンツを提案します
          </p>
        </div>
        {suggestions.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings2 className="h-4 w-4 mr-1" />
              設定
              {showSettings ? (
                <ChevronUp className="h-3 w-3 ml-1" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-1" />
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleScheduleAll}
              disabled={activeCount === 0 || !selectedAccountId}
            >
              <CalendarPlus className="h-4 w-4 mr-1" />
              すべて予約（{activeCount}件）
            </Button>
          </div>
        )}
      </div>

      {/* Generator Section */}
      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">カレンダー設定</CardTitle>
            <CardDescription>
              投稿スケジュールの条件を設定してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Account */}
              <div className="space-y-2">
                <Label>アカウント（任意）</Label>
                <Select
                  value={selectedAccountId}
                  onValueChange={setSelectedAccountId}
                  disabled={loadingAccounts}
                >
                  <SelectTrigger>
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
                <p className="text-xs text-muted-foreground">
                  選択すると過去データを参考に提案します
                </p>
              </div>

              {/* Period */}
              <div className="space-y-2">
                <Label>期間</Label>
                <Select
                  value={period}
                  onValueChange={(v) =>
                    setPeriod(v as "week" | "2weeks" | "month")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">1週間</SelectItem>
                    <SelectItem value="2weeks">2週間</SelectItem>
                    <SelectItem value="month">1ヶ月</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Posts per day */}
              <div className="space-y-2">
                <Label>1日あたりの投稿数</Label>
                <Select value={postsPerDay} onValueChange={setPostsPerDay}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1件</SelectItem>
                    <SelectItem value="2">2件</SelectItem>
                    <SelectItem value="3">3件</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Topics */}
              <div className="space-y-2 sm:col-span-2">
                <Label>希望トピック（任意）</Label>
                <Input
                  value={topicsInput}
                  onChange={(e) => setTopicsInput(e.target.value)}
                  placeholder="テクノロジー、ライフスタイル、ビジネス..."
                />
                <p className="text-xs text-muted-foreground">
                  カンマ区切りで複数のトピックを指定できます
                </p>
              </div>

              {/* Tone */}
              <div className="space-y-2">
                <Label>トーン</Label>
                <Select
                  value={tone}
                  onValueChange={(v) => setTone(v as ToneType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {toneOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {loading ? "生成中..." : "カレンダー生成"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
              onClick={() => setError(null)}
            >
              閉じる
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-3 py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                AIが{periodLabel}分のコンテンツカレンダーを作成しています...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No accounts warning */}
      {!loadingAccounts && accounts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">
              Threadsアカウントが未接続です
            </p>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
              投稿を予約するにはアカウントの接続が必要です。
              カレンダーの生成自体はアカウントなしでも可能です。
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

      {/* Calendar Results */}
      {suggestions.length > 0 && !loading && (
        <div className="flex flex-col gap-6">
          {/* Summary */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            {sortedDates.length}日間、合計{suggestions.length}件の投稿を提案
            {scheduledIndices.size > 0 && (
              <Badge variant="default" className="text-xs">
                {scheduledIndices.size}件予約済み
              </Badge>
            )}
            {skippedIndices.size > 0 && (
              <Badge variant="secondary" className="text-xs">
                {skippedIndices.size}件スキップ
              </Badge>
            )}
          </div>

          {/* Timeline by date */}
          {sortedDates.map((dateStr) => {
            const items = suggestionsByDate[dateStr];
            let dateLabel: string;
            try {
              const parsed = parseISO(dateStr);
              dateLabel = format(parsed, "M月d日（E）", { locale: ja });
            } catch {
              dateLabel = dateStr;
            }

            return (
              <div key={dateStr}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {dateStr.split("-")[2]}
                  </div>
                  <h3 className="text-sm font-semibold">{dateLabel}</h3>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Post cards */}
                <div className="flex flex-col gap-3 ml-10">
                  {items.map(({ index, suggestion }) => (
                    <div key={index} className="relative">
                      {scheduledIndices.has(index) && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 rounded-xl">
                          <Badge
                            variant="default"
                            className="text-sm px-4 py-1"
                          >
                            予約済み
                          </Badge>
                        </div>
                      )}
                      <CalendarSuggestionCard
                        suggestion={suggestion}
                        isSkipped={skippedIndices.has(index)}
                        onSchedule={(content, topicTag) =>
                          handleSchedulePost(index, content, topicTag)
                        }
                        onEditAndSchedule={(content, topicTag) =>
                          handleSchedulePost(index, content, topicTag)
                        }
                        onSkip={() => {
                          setSkippedIndices((prev) => {
                            const next = new Set(prev);
                            if (next.has(index)) {
                              next.delete(index);
                            } else {
                              next.add(index);
                            }
                            return next;
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && suggestions.length === 0 && !error && (
        <div />
      )}
    </div>
  );
}
