import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">トップページへ戻る</span>
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold">Threads Auto</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/40">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <Link href="/terms" className="transition-colors hover:text-foreground">
              利用規約
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              プライバシーポリシー
            </Link>
            <Link href="/tokushoho" className="transition-colors hover:text-foreground">
              特定商取引法に基づく表記
            </Link>
          </nav>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Threads Auto. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
