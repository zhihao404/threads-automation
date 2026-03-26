"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ListOrdered, Loader2, AlertCircle } from "lucide-react";
import { QueueList } from "@/components/queue/queue-list";

interface ThreadsAccount {
  id: string;
  username: string;
  displayName: string | null;
  profilePictureUrl: string | null;
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-72 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-9 w-32 bg-muted rounded animate-pulse" />
      </div>
      <div className="h-10 w-60 bg-muted rounded animate-pulse" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse flex items-start gap-3">
                <div className="h-5 w-10 bg-muted rounded shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full bg-muted rounded" />
                  <div className="h-4 w-2/3 bg-muted rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function QueuePage() {
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/accounts");
      if (!response.ok) {
        throw new Error("アカウントの取得に失敗しました");
      }
      const data = (await response.json()) as {
        accounts: ThreadsAccount[];
      };
      setAccounts(data.accounts || []);
      if (data.accounts && data.accounts.length > 0) {
        setSelectedAccountId(data.accounts[0].id);
      }
    } catch {
      setError("アカウント情報の読み込みに失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">投稿キュー</h1>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">投稿キュー</h1>
          <p className="text-muted-foreground text-sm mt-1">
            投稿キューを使って自動的にスケジュール公開できます。
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">
            Threadsアカウントが未接続です
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            キュー機能を使用するには、まずThreadsアカウントを接続してください。
          </p>
          <Button asChild>
            <Link href="/accounts">アカウントを接続</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">投稿キュー</h1>
          <p className="text-muted-foreground text-sm mt-1">
            キューに追加した投稿は、設定した間隔で自動的に公開されます。ドラッグ&ドロップで順番を変更できます。
          </p>
        </div>
        <Button asChild>
          <Link href="/posts/new">
            <Plus className="h-4 w-4 mr-2" />
            新しい投稿
          </Link>
        </Button>
      </div>

      {/* Account Selector (if multiple accounts) */}
      {accounts.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">アカウント</label>
          <Select
            value={selectedAccountId}
            onValueChange={setSelectedAccountId}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="アカウントを選択" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  @{account.username}
                  {account.displayName && ` (${account.displayName})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Queue List */}
      {selectedAccountId && <QueueList accountId={selectedAccountId} />}

      {/* How it works */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <ListOrdered className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h3 className="text-sm font-medium">キュー機能について</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>
                  - 下書きの投稿をキューに追加すると、設定した投稿間隔で自動的に公開されます。
                </li>
                <li>
                  - キュー内の投稿はドラッグ&ドロップで順番を変更できます。
                </li>
                <li>
                  - 一時停止にすると、再開するまで自動公開が停止されます。
                </li>
                <li>
                  - キューから削除された投稿は、下書きに戻ります。
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
