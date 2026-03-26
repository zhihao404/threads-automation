"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <h2 className="text-xl font-semibold">予期しないエラーが発生しました</h2>
      <p className="text-muted-foreground text-center">
        問題が解決しない場合は、ページを再読み込みしてください。
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>再試行</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          ホームに戻る
        </Button>
      </div>
    </div>
  );
}
