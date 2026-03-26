import Link from "next/link";
import {
  Sparkles,
  Calendar,
  BarChart3,
  Bot,
  Users,
  MessageSquare,
  FileText,
  ArrowRight,
  Link as LinkIcon,
  PenLine,
  TrendingUp,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FeatureCard } from "@/components/landing/feature-card";
import { PricingCard } from "@/components/landing/pricing-card";
import { FAQSection } from "@/components/landing/faq-section";

const features = [
  {
    icon: Calendar,
    title: "投稿の自動化",
    description:
      "スケジュール投稿、定期投稿、投稿キューで、最適なタイミングに自動で投稿。手間なく継続的な発信を実現します。",
  },
  {
    icon: Bot,
    title: "AIコンテンツ生成",
    description:
      "トピックを入力するだけでAIが投稿を自動生成。トーン指定やテンプレートで、あなたらしい発信を効率化します。",
  },
  {
    icon: BarChart3,
    title: "パフォーマンス分析",
    description:
      "リアルタイムダッシュボードで閲覧数、いいね、リプライを可視化。データに基づいた投稿戦略を立てられます。",
  },
  {
    icon: Users,
    title: "フォロワー分析",
    description:
      "フォロワーのデモグラフィクスや成長トラッキングで、オーディエンスを深く理解。ターゲットに合った施策を。",
  },
  {
    icon: MessageSquare,
    title: "リプライ管理",
    description:
      "リプライの一覧表示、非表示/表示の切り替え、通知管理で、コミュニティとの対話を効率的に管理できます。",
  },
  {
    icon: FileText,
    title: "レポート生成",
    description:
      "AIが週次・月次のパフォーマンスレポートを自動生成。HTMLでダウンロードして、チームへの共有も簡単です。",
  },
];

const steps = [
  {
    icon: LinkIcon,
    step: "01",
    title: "アカウント連携",
    description:
      "Threadsアカウントをワンクリックで連携。面倒な設定は一切不要です。",
  },
  {
    icon: PenLine,
    step: "02",
    title: "コンテンツ作成",
    description:
      "AIで投稿を作成し、スケジュールを設定。あとは自動でお任せください。",
  },
  {
    icon: TrendingUp,
    step: "03",
    title: "分析・改善",
    description:
      "パフォーマンスを分析し、エンゲージメントを最大化。データで成長を加速します。",
  },
];

const testimonials = [
  {
    quote:
      "Threads Autoを使い始めてから、投稿の頻度を3倍にできました。AIの生成機能が特に気に入っています。",
    name: "田中 美咲",
    role: "コンテンツクリエイター",
  },
  {
    quote:
      "分析ダッシュボードのおかげで、どの投稿が反響を呼んでいるか一目瞭然。戦略的な運用ができるようになりました。",
    name: "佐藤 健太",
    role: "マーケティングマネージャー",
  },
  {
    quote:
      "スケジュール投稿がとにかく便利。週末にまとめて作成して、平日は自動投稿。時間の使い方が変わりました。",
    name: "鈴木 あかり",
    role: "フリーランスデザイナー",
  },
];

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
      "基本分析機能",
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
      "フル分析・週次レポート",
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
      "無制限の全機能",
      "AI生成 無制限",
      "週次+月次レポート",
      "優先サポート",
    ],
    ctaText: "Businessを始める",
    ctaHref: "/register?plan=business",
  },
];

export default function LandingPage() {
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
                <a href="#features">機能</a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="#pricing">料金</a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="#faq">FAQ</a>
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
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-purple-500/5 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-pink-500/5 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge
              variant="secondary"
              className="mb-6 gap-1.5 px-3 py-1 text-xs font-medium"
            >
              <Star className="h-3 w-3 fill-purple-600 text-purple-600" />
              1,000+ クリエイターが利用中
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Threadsを、
              <br className="sm:hidden" />
              もっと
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                スマート
              </span>
              に。
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
              投稿の自動化、AIコンテンツ生成、パフォーマンス分析。
              <br className="hidden sm:block" />
              Threadsの成長に必要なすべてが、ここに。
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 hover:from-purple-700 hover:to-pink-700 px-8 h-12 text-base"
              >
                <Link href="/register">
                  無料で始める
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="px-8 h-12 text-base"
              >
                <a href="#pricing">料金を見る</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              クレジットカード不要 / セットアップ1分
            </p>
          </div>

          {/* Dashboard mockup */}
          <div className="mx-auto mt-16 max-w-4xl sm:mt-20">
            <div className="relative rounded-2xl border bg-gradient-to-br from-purple-50 via-white to-pink-50 p-2 shadow-2xl shadow-purple-500/10">
              <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 sm:p-8">
                <div className="flex items-center gap-2 mb-6">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                  <span className="ml-3 text-xs text-slate-400">
                    Threads Auto - ダッシュボード
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg bg-slate-800/80 p-4">
                    <div className="text-xs text-slate-400">今月の投稿数</div>
                    <div className="mt-1 text-2xl font-bold text-white">
                      128
                    </div>
                    <div className="mt-1 text-xs text-green-400">+23%</div>
                  </div>
                  <div className="rounded-lg bg-slate-800/80 p-4">
                    <div className="text-xs text-slate-400">
                      エンゲージメント
                    </div>
                    <div className="mt-1 text-2xl font-bold text-white">
                      4.2%
                    </div>
                    <div className="mt-1 text-xs text-green-400">+0.8%</div>
                  </div>
                  <div className="rounded-lg bg-slate-800/80 p-4">
                    <div className="text-xs text-slate-400">フォロワー</div>
                    <div className="mt-1 text-2xl font-bold text-white">
                      2,847
                    </div>
                    <div className="mt-1 text-xs text-green-400">+312</div>
                  </div>
                </div>
                <div className="mt-4 rounded-lg bg-slate-800/80 p-4">
                  <div className="text-xs text-slate-400 mb-3">
                    週間パフォーマンス
                  </div>
                  <div className="flex items-end gap-2 h-24">
                    {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-to-t from-purple-600 to-pink-500"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                    <span>月</span>
                    <span>火</span>
                    <span>水</span>
                    <span>木</span>
                    <span>金</span>
                    <span>土</span>
                    <span>日</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-muted/30 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge
              variant="secondary"
              className="mb-4 px-3 py-1 text-xs font-medium"
            >
              機能
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Threads運用に必要な
              <br className="hidden sm:block" />
              すべてを、ひとつに。
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              投稿・分析・AI生成。成長のための機能を、ワンストップで。
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge
              variant="secondary"
              className="mb-4 px-3 py-1 text-xs font-medium"
            >
              はじめ方
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              3ステップで始められます
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              難しい設定は不要。すぐに始められます。
            </p>
          </div>
          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {steps.map((step) => (
              <div key={step.step} className="relative text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20">
                  <step.icon className="h-6 w-6" />
                </div>
                <div className="mt-2 text-xs font-bold text-purple-600 tracking-wider">
                  STEP {step.step}
                </div>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section id="pricing" className="border-t bg-muted/30 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge
              variant="secondary"
              className="mb-4 px-3 py-1 text-xs font-medium"
            >
              料金
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              シンプルでわかりやすい料金
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              無料で始めて、成長に合わせてアップグレード。
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8 items-start">
            {plans.map((plan) => (
              <PricingCard key={plan.name} {...plan} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button variant="link" asChild className="gap-1 text-purple-600">
              <Link href="/pricing">
                すべての機能を比較する
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge
              variant="secondary"
              className="mb-4 px-3 py-1 text-xs font-medium"
            >
              ユーザーの声
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              利用者の声
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              多くのクリエイターやビジネスに選ばれています。
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.name}
                className="flex flex-col rounded-2xl border bg-card p-6 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/5"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>
                <blockquote className="flex-1 text-sm leading-relaxed text-muted-foreground">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-400 text-sm font-bold text-white">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">
                      {testimonial.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {testimonial.role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t bg-muted/30 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge
              variant="secondary"
              className="mb-4 px-3 py-1 text-xs font-medium"
            >
              FAQ
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              よくある質問
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              ご不明な点はお気軽にお問い合わせください。
            </p>
          </div>
          <div className="mt-14">
            <FAQSection />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/4 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-purple-500/5 blur-3xl" />
          <div className="absolute right-1/4 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-pink-500/5 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
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
              <a
                href="#features"
                className="transition-colors hover:text-foreground"
              >
                機能
              </a>
              <a
                href="#pricing"
                className="transition-colors hover:text-foreground"
              >
                料金
              </a>
              <a
                href="#faq"
                className="transition-colors hover:text-foreground"
              >
                FAQ
              </a>
              <Link
                href="/terms"
                className="transition-colors hover:text-foreground"
              >
                利用規約
              </Link>
              <Link
                href="/privacy"
                className="transition-colors hover:text-foreground"
              >
                プライバシーポリシー
              </Link>
              <Link
                href="/tokushoho"
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
