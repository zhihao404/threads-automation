"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileBarChart,
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
  Users,
  Calendar,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ReportCard } from "@/components/reports/report-card";

export interface ReportsThreadsAccount {
  id: string;
  username: string;
  displayName: string | null;
}

export interface ReportListItem {
  id: string;
  accountId: string;
  type: "weekly" | "monthly";
  title: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  status: "generating" | "completed" | "failed";
  createdAt: string;
}

interface ReportsClientProps {
  initialAccounts: ReportsThreadsAccount[];
  initialReports: ReportListItem[];
  initialSelectedAccountId: string;
}

export function ReportsClient({
  initialAccounts,
  initialReports,
  initialSelectedAccountId,
}: ReportsClientProps) {
  const router = useRouter();
  const [accounts] = useState<ReportsThreadsAccount[]>(initialAccounts);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialSelectedAccountId);
  const [reports, setReports] = useState<ReportListItem[]>(initialReports);
  const [loadingReports, setLoadingReports] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAccountId, setDialogAccountId] = useState<string>(initialSelectedAccountId);
  const [reportType, setReportType] = useState<"weekly" | "monthly">("weekly");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Fetch reports when selectedAccountId changes (skip initial since we have server data)
  const [isFirstRender, setIsFirstRender] = useState(true);

  const fetchReports = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!selectedAccountId) return;
    setLoadingReports(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/reports?accountId=${selectedAccountId}&limit=20`
      );
      if (signal?.cancelled) return;
      if (!res.ok) throw new Error("レポートの取得に失敗しました");
      const data = (await res.json()) as { reports: ReportListItem[] };
      if (signal?.cancelled) return;
      setReports(data.reports || []);
    } catch {
      if (signal?.cancelled) return;
      setError("レポートの取得に失敗しました");
    } finally {
      if (!signal?.cancelled) {
        setLoadingReports(false);
      }
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (isFirstRender) {
      setIsFirstRender(false);
      return;
    }
    const signal = { cancelled: false };
    fetchReports(signal);
    return () => {
      signal.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchReports]);

  // Generate report
  const handleGenerate = async () => {
    if (!dialogAccountId) return;
    setGenerating(true);
    setGenerateError(null);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: dialogAccountId,
          type: reportType,
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as { error?: string };
        throw new Error(errorData.error || "レポートの生成に失敗しました");
      }

      setDialogOpen(false);
      // If the generated report is for the currently selected account, refresh
      if (dialogAccountId === selectedAccountId) {
        fetchReports();
      } else {
        setSelectedAccountId(dialogAccountId);
      }
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "レポートの生成に失敗しました"
      );
    } finally {
      setGenerating(false);
    }
  };

  // Calculate period display
  const now = new Date();
  const weeklyEnd = now.toISOString().split("T")[0];
  const weeklyStart = new Date(now);
  weeklyStart.setDate(weeklyStart.getDate() - 7);
  const weeklyStartStr = weeklyStart.toISOString().split("T")[0];

  const monthlyEnd = weeklyEnd;
  const monthlyStart = new Date(now);
  monthlyStart.setDate(monthlyStart.getDate() - 30);
  const monthlyStartStr = monthlyStart.toISOString().split("T")[0];

  const periodDisplay =
    reportType === "weekly"
      ? `${weeklyStartStr} 〜 ${weeklyEnd}`
      : `${monthlyStartStr} 〜 ${monthlyEnd}`;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileBarChart className="h-6 w-6 text-primary" />
            レポート
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI が生成した週次・月次パフォーマンスレポート
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Account selector */}
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

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={accounts.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                レポート生成
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>レポート生成</DialogTitle>
                <DialogDescription>
                  パフォーマンスレポートを AI が自動生成します
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-4 py-4">
                {/* Account selector in dialog */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">アカウント</label>
                  <Select
                    value={dialogAccountId}
                    onValueChange={setDialogAccountId}
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
                </div>

                {/* Report type */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">レポート種別</label>
                  <Select
                    value={reportType}
                    onValueChange={(v) =>
                      setReportType(v as "weekly" | "monthly")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">週次レポート</SelectItem>
                      <SelectItem value="monthly">月次レポート</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Period display */}
                <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">対象期間</p>
                    <p className="text-xs text-muted-foreground">
                      {periodDisplay}
                    </p>
                  </div>
                </div>

                {/* Error */}
                {generateError && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-sm text-destructive">{generateError}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  onClick={handleGenerate}
                  disabled={generating || !dialogAccountId}
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileBarChart className="h-4 w-4 mr-2" />
                  )}
                  {generating ? "生成中..." : "生成する"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
              onClick={() => fetchReports()}
              disabled={loadingReports}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              再試行
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loadingReports && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <p className="text-sm text-muted-foreground">
            レポートを読み込み中...
          </p>
        </div>
      )}

      {/* No accounts */}
      {accounts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">
              Threads アカウントが未接続です
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              レポートを生成するには、まずアカウントを接続してください
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

      {/* Report list */}
      {!loadingReports && reports.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loadingReports &&
        reports.length === 0 &&
        accounts.length > 0 &&
        !error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12">
              <FileBarChart className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                まだレポートがありません
              </p>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                「レポート生成」ボタンをクリックして、AI
                にパフォーマンスレポートを自動生成させましょう。
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                レポート生成
              </Button>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
