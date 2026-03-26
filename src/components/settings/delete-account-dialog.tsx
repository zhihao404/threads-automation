"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2 } from "lucide-react";

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmation === "DELETE";

  async function handleDelete() {
    if (!isConfirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "アカウントの削除に失敗しました");
      }

      // Redirect to home page after successful deletion
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setIsDeleting(false);
    }
  }

  function handleOpenChange(value: boolean) {
    setOpen(value);
    if (!value) {
      setConfirmation("");
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          アカウントを削除
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            アカウント削除の確認
          </DialogTitle>
          <DialogDescription>
            この操作は取り消すことができません。全てのデータが完全に削除されます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">
              以下のデータが全て削除されます:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>アカウント情報（プロフィール、メールアドレス）</li>
              <li>接続されたThreadsアカウント</li>
              <li>全ての投稿データ・下書き・予約投稿</li>
              <li>テンプレート・AI生成履歴</li>
              <li>アナリティクスデータ・レポート</li>
              <li>通知・スケジュール設定</li>
              <li>有料プランの場合、サブスクリプションもキャンセルされます</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-confirmation">
              確認のため <span className="font-mono font-bold">DELETE</span> と入力してください
            </Label>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
              disabled={isDeleting}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
          >
            {isDeleting ? "削除中..." : "アカウントを完全に削除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
