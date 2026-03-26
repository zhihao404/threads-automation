"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  Crown,
  Building2,
  Zap,
  AlertTriangle,
  ExternalLink,
  Check,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BillingData {
  plan: "free" | "pro" | "business";
  planName: string;
  planNameJa: string;
  price: number;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  hasStripeSubscription: boolean;
  limits: {
    accounts: number;
    postsPerMonth: number;
    scheduledPosts: number;
    aiGenerations: number;
    templates: number;
    analytics: string;
    reports: string;
    replyManagement: string;
  };
  usage: {
    posts: number;
    aiGenerations: number;
    scheduledPosts: number;
    templates: number;
  };
  periodStart: string;
  periodEnd: string;
}

// ---------------------------------------------------------------------------
// Plan definitions for the comparison table
// ---------------------------------------------------------------------------

const PLAN_DETAILS = [
  {
    key: "free" as const,
    name: "フリー",
    price: 0,
    icon: Zap,
    color: "text-gray-600",
    bgColor: "bg-gray-50 dark:bg-gray-900/30",
  },
  {
    key: "pro" as const,
    name: "プロ",
    price: 1980,
    icon: Crown,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/30",
  },
  {
    key: "business" as const,
    name: "ビジネス",
    price: 4980,
    icon: Building2,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-900/30",
  },
];

const FEATURE_ROWS = [
  { label: "Threadsアカウント数", free: "1", pro: "3", business: "10" },
  { label: "投稿数/月", free: "30", pro: "無制限", business: "無制限" },
  { label: "スケジュール投稿", free: "5件まで", pro: "無制限", business: "無制限" },
  { label: "AI生成", free: "10回/月", pro: "100回/月", business: "無制限" },
  { label: "テンプレート", free: "5個", pro: "50個", business: "無制限" },
  { label: "分析", free: "基本のみ", pro: "フル", business: "フル" },
  { label: "レポート", free: "なし", pro: "週次のみ", business: "週次+月次" },
  { label: "リプライ管理", free: "閲覧のみ", pro: "フル", business: "フル" },
  { label: "優先サポート", free: false, pro: false, business: true },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>}>
      <BillingPageContent />
    </Suspense>
  );
}

function BillingPageContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";

  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBilling = useCallback(async () => {
    try {
      const res = await fetch("/api/billing");
      if (!res.ok) throw new Error("Failed to fetch billing data");
      const data = (await res.json()) as BillingData;
      setBilling(data);
    } catch {
      setError("請求情報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  const handleCheckout = async (plan: "pro" | "business") => {
    setActionLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "エラーが発生しました");
      }
    } catch {
      setError("チェックアウトの開始に失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePortal = async () => {
    setActionLoading("portal");
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "エラーが発生しました");
      }
    } catch {
      setError("ポータルの開始に失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <BillingSkeleton />;
  }

  if (error && !billing) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">プランと請求</h2>
          <p className="text-muted-foreground">
            サブスクリプションと使用量を管理します。
          </p>
        </div>
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!billing) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">プランと請求</h2>
        <p className="text-muted-foreground">
          サブスクリプションと使用量を管理します。
        </p>
      </div>

      {/* Success message */}
      {success && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20">
          <CardContent className="flex items-center gap-2 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              プランが更新されました！
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error message */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
          <CardContent className="flex items-center gap-2 p-4">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              {error}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                現在のプラン
                <StatusBadge status={billing.status} />
              </CardTitle>
              <CardDescription>
                {billing.planNameJa}プラン
                {billing.price > 0 && (
                  <span className="ml-1">
                    - ¥{billing.price.toLocaleString()}/月
                  </span>
                )}
              </CardDescription>
            </div>
            <PlanIcon plan={billing.plan} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {billing.currentPeriodEnd && (
            <div className="text-sm text-muted-foreground">
              <p>
                現在の期間: {formatDisplayDate(billing.periodStart)} 〜{" "}
                {formatDisplayDate(billing.periodEnd)}
              </p>
              {billing.cancelAtPeriodEnd && (
                <p className="mt-1 flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  期間終了時にキャンセルされます（{formatDisplayDate(billing.periodEnd)}）
                </p>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          {billing.hasStripeSubscription && (
            <Button
              variant="outline"
              onClick={handlePortal}
              disabled={actionLoading === "portal"}
            >
              {actionLoading === "portal" ? "読み込み中..." : "サブスクリプション管理"}
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Usage This Period */}
      <Card>
        <CardHeader>
          <CardTitle>今月の使用量</CardTitle>
          <CardDescription>
            {formatDisplayDate(billing.periodStart)} 〜{" "}
            {formatDisplayDate(billing.periodEnd)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UsageBar
            label="投稿"
            used={billing.usage.posts}
            limit={billing.limits.postsPerMonth}
          />
          <UsageBar
            label="AI生成"
            used={billing.usage.aiGenerations}
            limit={billing.limits.aiGenerations}
          />
          <UsageBar
            label="テンプレート"
            used={billing.usage.templates}
            limit={billing.limits.templates}
          />
          <UsageBar
            label="アカウント"
            used={0}
            limit={billing.limits.accounts}
          />
          <UsageBar
            label="スケジュール投稿"
            used={billing.usage.scheduledPosts}
            limit={billing.limits.scheduledPosts}
          />
        </CardContent>
      </Card>

      {/* Plan Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>プラン比較</CardTitle>
          <CardDescription>
            あなたに最適なプランをお選びください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Plan headers */}
          <div className="grid grid-cols-4 gap-4 pb-4">
            <div />
            {PLAN_DETAILS.map((p) => {
              const Icon = p.icon;
              const isCurrent = billing.plan === p.key;
              return (
                <div
                  key={p.key}
                  className={`rounded-lg p-4 text-center ${
                    isCurrent
                      ? "ring-2 ring-primary"
                      : ""
                  } ${p.bgColor}`}
                >
                  <Icon className={`mx-auto mb-2 h-6 w-6 ${p.color}`} />
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.price === 0
                      ? "無料"
                      : `¥${p.price.toLocaleString()}/月`}
                  </p>
                  {isCurrent && (
                    <Badge className="mt-2" variant="secondary">
                      現在のプラン
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          <Separator className="my-4" />

          {/* Feature rows */}
          <div className="space-y-0">
            {FEATURE_ROWS.map((row, idx) => (
              <div
                key={row.label}
                className={`grid grid-cols-4 gap-4 py-3 ${
                  idx < FEATURE_ROWS.length - 1 ? "border-b" : ""
                }`}
              >
                <div className="text-sm font-medium">{row.label}</div>
                {(["free", "pro", "business"] as const).map((plan) => {
                  const value = row[plan];
                  return (
                    <div
                      key={plan}
                      className={`text-center text-sm ${
                        billing.plan === plan
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {typeof value === "boolean" ? (
                        value ? (
                          <Check className="mx-auto h-4 w-4 text-green-600" />
                        ) : (
                          <X className="mx-auto h-4 w-4 text-gray-400" />
                        )
                      ) : (
                        value
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          {/* Action buttons */}
          <div className="grid grid-cols-4 gap-4">
            <div />
            {PLAN_DETAILS.map((p) => {
              const isCurrent = billing.plan === p.key;
              const isDowngrade =
                (billing.plan === "business" && p.key === "pro") ||
                (billing.plan !== "free" && p.key === "free");
              const isUpgrade =
                (billing.plan === "free" &&
                  (p.key === "pro" || p.key === "business")) ||
                (billing.plan === "pro" && p.key === "business");

              if (isCurrent) {
                return (
                  <div key={p.key} className="text-center">
                    <Button variant="outline" disabled className="w-full">
                      現在のプラン
                    </Button>
                  </div>
                );
              }

              if (p.key === "free") {
                // Downgrade to free via portal
                if (billing.hasStripeSubscription) {
                  return (
                    <div key={p.key} className="text-center">
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={handlePortal}
                        disabled={actionLoading === "portal"}
                      >
                        ダウングレード
                      </Button>
                    </div>
                  );
                }
                return (
                  <div key={p.key} className="text-center">
                    <Button variant="outline" disabled className="w-full">
                      現在のプラン
                    </Button>
                  </div>
                );
              }

              if (isDowngrade) {
                return (
                  <div key={p.key} className="text-center">
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={handlePortal}
                      disabled={actionLoading === "portal"}
                    >
                      ダウングレード
                    </Button>
                  </div>
                );
              }

              if (isUpgrade) {
                if (billing.hasStripeSubscription) {
                  // Already has a subscription -- use portal to switch plans
                  return (
                    <div key={p.key} className="text-center">
                      <Button
                        className="w-full"
                        onClick={handlePortal}
                        disabled={actionLoading === "portal"}
                      >
                        {actionLoading === "portal"
                          ? "読み込み中..."
                          : "アップグレード"}
                      </Button>
                    </div>
                  );
                }
                return (
                  <div key={p.key} className="text-center">
                    <Button
                      className="w-full"
                      onClick={() =>
                        handleCheckout(p.key as "pro" | "business")
                      }
                      disabled={actionLoading === p.key}
                    >
                      {actionLoading === p.key
                        ? "読み込み中..."
                        : "アップグレード"}
                    </Button>
                  </div>
                );
              }

              return <div key={p.key} />;
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    { label: string; className: string }
  > = {
    active: {
      label: "有効",
      className:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    trialing: {
      label: "トライアル",
      className:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    past_due: {
      label: "支払い遅延",
      className:
        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
    canceled: {
      label: "キャンセル済み",
      className:
        "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    },
    incomplete: {
      label: "未完了",
      className:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
  };

  const v = variants[status] ?? variants.active;
  return (
    <Badge variant="secondary" className={v!.className}>
      {v!.label}
    </Badge>
  );
}

function PlanIcon({ plan }: { plan: string }) {
  if (plan === "business")
    return <Building2 className="h-8 w-8 text-purple-600" />;
  if (plan === "pro") return <Crown className="h-8 w-8 text-blue-600" />;
  return <Zap className="h-8 w-8 text-gray-500" />;
}

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && percentage >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {used.toLocaleString()}
          {isUnlimited ? " (無制限)" : ` / ${limit.toLocaleString()}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-all ${
              isAtLimit
                ? "bg-red-500"
                : isNearLimit
                  ? "bg-amber-500"
                  : "bg-primary"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

function formatDisplayDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function BillingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">プランと請求</h2>
        <p className="text-muted-foreground">
          サブスクリプションと使用量を管理します。
        </p>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
