"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileForm } from "@/components/settings/profile-form";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";
import {
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  User,
  Bell,
  Link2,
  Shield,
  ExternalLink,
  Download,
  ArrowUpRight,
  Loader2,
} from "lucide-react";

interface AccountData {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    createdAt: string;
  };
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  accounts: Array<{
    id: string;
    username: string;
    displayName: string | null;
    profilePictureUrl: string | null;
    tokenExpiresAt: string;
  }>;
}

const planLabels: Record<string, { label: string; color: string }> = {
  free: {
    label: "Free",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  pro: {
    label: "Pro",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  business: {
    label: "Business",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
};

function getTokenStatus(expiresAt: string): {
  label: string;
  daysLeft: number;
  variant: "active" | "warning" | "expired";
} {
  const now = new Date();
  const expires = new Date(expiresAt);
  const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) {
    return { label: "期限切れ", daysLeft: 0, variant: "expired" };
  }
  if (daysLeft <= 7) {
    return { label: `残り${daysLeft}日`, daysLeft, variant: "warning" };
  }
  return { label: `残り${daysLeft}日`, daysLeft, variant: "active" };
}

export default function SettingsPage() {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notifications, setNotifications] = useState({
    postPublished: true,
    scheduledReminder: true,
    weeklyReport: false,
    newReplies: true,
    mentions: true,
  });

  useEffect(() => {
    async function fetchAccount() {
      try {
        const res = await fetch("/api/account");
        if (!res.ok) throw new Error("Failed to fetch account data");
        const json = (await res.json()) as AccountData;
        setData(json);
      } catch {
        setError("アカウント情報の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }
    fetchAccount();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">設定</h2>
          <p className="text-muted-foreground">アカウントとアプリケーションの設定を管理します。</p>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {error || "データを読み込めませんでした"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user, subscription, accounts } = data;
  const plan = planLabels[subscription.plan] ?? planLabels.free;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">設定</h2>
        <p className="text-muted-foreground">
          アカウントとアプリケーションの設定を管理します。
        </p>
      </div>

      <div className="grid gap-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>プロフィール</CardTitle>
                <CardDescription>アカウント情報を管理します。</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.image ?? undefined} alt={user.name} />
                <AvatarFallback className="text-lg">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <Separator />

            <ProfileForm initialName={user.name} email={user.email} />
          </CardContent>
        </Card>

        {/* Billing Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>プランと請求</CardTitle>
                <CardDescription>現在のプランと請求情報を管理します。</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">現在のプラン</p>
                  <Badge variant="secondary" className={plan.color}>
                    {plan.label}
                  </Badge>
                </div>
                {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString("ja-JP")} にキャンセルされます
                  </p>
                )}
              </div>
            </div>

            {/* Usage summary bars */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">利用状況</p>
              <UsageBar
                label="月間投稿数"
                current={12}
                limit={subscription.plan === "free" ? 30 : -1}
              />
              <UsageBar
                label="AI生成回数"
                current={3}
                limit={
                  subscription.plan === "free"
                    ? 10
                    : subscription.plan === "pro"
                      ? 100
                      : -1
                }
              />
              <UsageBar
                label="接続アカウント"
                current={accounts.length}
                limit={
                  subscription.plan === "free"
                    ? 1
                    : subscription.plan === "pro"
                      ? 3
                      : 10
                }
              />
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/billing">
                  <CreditCard className="mr-2 h-4 w-4" />
                  請求管理
                </Link>
              </Button>
              {subscription.plan === "free" && (
                <Button size="sm" asChild>
                  <Link href="/pricing">
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    プランをアップグレード
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>通知設定</CardTitle>
                <CardDescription>受け取る通知を選択します。</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>投稿公開時の通知</Label>
                <p className="text-sm text-muted-foreground">
                  投稿がThreadsに公開された時に通知します。
                </p>
              </div>
              <Switch
                checked={notifications.postPublished}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({
                    ...prev,
                    postPublished: checked,
                  }))
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>スケジュールリマインダー</Label>
                <p className="text-sm text-muted-foreground">
                  予約投稿の実行前にリマインダーを送信します。
                </p>
              </div>
              <Switch
                checked={notifications.scheduledReminder}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({
                    ...prev,
                    scheduledReminder: checked,
                  }))
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>週次レポート通知</Label>
                <p className="text-sm text-muted-foreground">
                  毎週のパフォーマンスレポートを通知します。
                </p>
              </div>
              <Switch
                checked={notifications.weeklyReport}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({
                    ...prev,
                    weeklyReport: checked,
                  }))
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>新着リプライ通知</Label>
                <p className="text-sm text-muted-foreground">
                  投稿にリプライがあった時に通知します。
                </p>
              </div>
              <Switch
                checked={notifications.newReplies}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({
                    ...prev,
                    newReplies: checked,
                  }))
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>メンション通知</Label>
                <p className="text-sm text-muted-foreground">
                  メンションされた時に通知します。
                </p>
              </div>
              <Switch
                checked={notifications.mentions}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({
                    ...prev,
                    mentions: checked,
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Connected Accounts Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>接続済みアカウント</CardTitle>
                <CardDescription>接続されたThreadsアカウントを管理します。</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                接続されたアカウントはありません。
              </p>
            ) : (
              accounts.map((acc) => {
                const tokenStatus = getTokenStatus(acc.tokenExpiresAt);
                return (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={acc.profilePictureUrl ?? undefined}
                          alt={acc.username}
                        />
                        <AvatarFallback className="text-xs">
                          {acc.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">@{acc.username}</p>
                        {acc.displayName && (
                          <p className="text-xs text-muted-foreground">
                            {acc.displayName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {tokenStatus.label}
                      </span>
                      {tokenStatus.variant === "active" ? (
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          有効
                        </Badge>
                      ) : tokenStatus.variant === "warning" ? (
                        <Badge
                          variant="secondary"
                          className="gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          期限間近
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          期限切れ
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            <div className="pt-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/accounts">アカウントを接続</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data & Privacy Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>データとプライバシー</CardTitle>
                <CardDescription>データのエクスポートやアカウント削除を行います。</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">データエクスポート</p>
                <p className="text-sm text-muted-foreground">
                  アカウントに保存されている全データをダウンロードします。
                </p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                エクスポート
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-destructive">アカウント削除</p>
                <p className="text-sm text-muted-foreground">
                  アカウントと全データを完全に削除します。この操作は取り消せません。
                </p>
              </div>
              <DeleteAccountDialog />
            </div>
          </CardContent>
        </Card>

        {/* Links Section */}
        <Card>
          <CardHeader>
            <CardTitle>法的情報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-3">
              <Link
                href="/terms"
                className="flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted"
                target="_blank"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                利用規約
              </Link>
              <Link
                href="/privacy"
                className="flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted"
                target="_blank"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                プライバシーポリシー
              </Link>
              <Link
                href="/tokushoho"
                className="flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted"
                target="_blank"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                特定商取引法に基づく表記
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Usage progress bar component
 */
function UsageBar({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number;
}) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min((current / limit) * 100, 100);
  const isNearLimit = !isUnlimited && percentage >= 80;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={isNearLimit ? "font-medium text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"}>
          {current} / {isUnlimited ? "無制限" : limit}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            isUnlimited
              ? "bg-green-500 dark:bg-green-600"
              : isNearLimit
                ? "bg-yellow-500 dark:bg-yellow-600"
                : "bg-primary"
          }`}
          style={{ width: isUnlimited ? "5%" : `${percentage}%` }}
        />
      </div>
    </div>
  );
}
