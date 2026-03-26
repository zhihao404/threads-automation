"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AuthError({
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
    <Card>
      <CardHeader>
        <CardTitle className="text-center">エラーが発生しました</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground text-center">
          認証中にエラーが発生しました。もう一度お試しください。
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button onClick={reset} className="w-full">
          再試行
        </Button>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/login">ログインページに戻る</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
