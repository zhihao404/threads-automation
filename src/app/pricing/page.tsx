import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PricingCard } from "@/components/landing/pricing-card";
import { ComparisonTable } from "@/components/landing/comparison-table";
import { FAQSection } from "@/components/landing/faq-section";

const plans = [
  {
    name: "Free",
    nameJa: "フリー",
    price: 0,
    description: "まずは無料で始めてみましょう",
    features: [
      "1 Threadsアカウント",
      "月30件の投稿",
      "5件のスケジュール投稿",
      "AI生成 10回/月",
      "テンプレート 5個",
      "基本分析機能",
      "リプライの閲覧",
    ],
    ctaText: "無料で始める",
    ctaHref: "/register",
  },
  {
    name: "Pro",
    nameJa: "プロ",
    price: 1980,
    description: "本格的な運用を始めたい方に",
    features: [
      "3 Threadsアカウント",
      "無制限の投稿",
      "無制限のスケジュール投稿",
      "AI生成 100回/月",
      "テンプレート 50個",
      "フル分析機能",
      "週次レポート",
      "リプライのフル管理",
    ],
    highlighted: true,
    ctaText: "Proを始める",
    ctaHref: "/register?plan=pro",
  },
  {
    name: "Business",
    nameJa: "ビジネス",
    price: 4980,
    description: "チームでの運用に最適",
    features: [
      "10 Threadsアカウント",
      "無制限の投稿",
      "無制限のスケジュール投稿",
      "AI生成 無制限",
      "テンプレート 無制限",
      "フル分析機能",
      "週次+月次レポート",
      "リプライのフル管理",
      "優先サポート",
    ],
    ctaText: "Businessを始める",
    ctaHref: "/register?plan=business",
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-lg font-semibold">Threads Auto</span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/#features">機能</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/pricing">料金</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/#faq">FAQ</Link>
              </Button>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">ログイン</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 hover:from-purple-700 hover:to-pink-700"
            >
              <Link href="/register">無料で始める</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-purple-500/5 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge
              variant="secondary"
              className="mb-4 px-3 py-1 text-xs font-medium"
            >
              料金プラン
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              シンプルでわかりやすい料金
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              無料で始めて、ビジネスの成長に合わせてアップグレード。
              <br className="hidden sm:block" />
              すべてのプランに14日間の無料トライアルが付きます。
            </p>
          </div>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8 items-start">
            {plans.map((plan) => (
              <PricingCard key={plan.name} {...plan} />
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="border-t bg-muted/30 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              機能の詳細比較
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              各プランの機能を詳しく比較できます。
            </p>
          </div>
          <div className="mt-14">
            <ComparisonTable />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge
              variant="secondary"
              className="mb-4 px-3 py-1 text-xs font-medium"
            >
              FAQ
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              よくある質問
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              ご不明な点はお気軽にお問い合わせください。
            </p>
          </div>
          <div className="mt-14">
            <FAQSection />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t bg-muted/30 py-20 md:py-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/4 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-purple-500/5 blur-3xl" />
          <div className="absolute right-1/4 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-pink-500/5 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              今すぐ始めましょう
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              クレジットカード不要で無料で始められます。
              <br className="hidden sm:block" />
              まずはフリープランでThreads Autoを体験してください。
            </p>
            <div className="mt-8">
              <Button
                size="lg"
                asChild
                className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 hover:from-purple-700 hover:to-pink-700 px-10 h-12 text-base"
              >
                <Link href="/register">
                  無料で始める
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="text-base font-semibold">Threads Auto</span>
              </Link>
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">
                Threadsの成長を加速する、オールインワンの運用ツール。
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
              <Link
                href="/#features"
                className="transition-colors hover:text-foreground"
              >
                機能
              </Link>
              <Link
                href="/pricing"
                className="transition-colors hover:text-foreground"
              >
                料金
              </Link>
              <Link
                href="/#faq"
                className="transition-colors hover:text-foreground"
              >
                FAQ
              </Link>
              <Link
                href="/legal/terms"
                className="transition-colors hover:text-foreground"
              >
                利用規約
              </Link>
              <Link
                href="/legal/privacy"
                className="transition-colors hover:text-foreground"
              >
                プライバシーポリシー
              </Link>
              <Link
                href="/legal/commerce"
                className="transition-colors hover:text-foreground"
              >
                特定商取引法
              </Link>
            </div>
          </div>
          <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Threads Auto. All rights
            reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
