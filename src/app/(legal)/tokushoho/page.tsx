import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | Threads Auto",
  description: "Threads Autoの特定商取引法に基づく表記です。",
};

export default function TokushohoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          特定商取引法に基づく表記
        </h1>
        <p className="mt-2 text-muted-foreground">
          最終更新日: 2026年3月1日
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            特定商取引法に基づく表記
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-foreground/90">
          <div className="divide-y">
            {/* 事業者名 */}
            <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="font-semibold">事業者名</dt>
              <dd className="sm:col-span-2 text-muted-foreground">[要設定]</dd>
            </div>

            <Separator className="hidden" />

            {/* 代表者名 */}
            <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="font-semibold">代表者名</dt>
              <dd className="sm:col-span-2 text-muted-foreground">[要設定]</dd>
            </div>

            {/* 所在地 */}
            <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="font-semibold">所在地</dt>
              <dd className="sm:col-span-2 text-muted-foreground">[要設定]</dd>
            </div>

            {/* 連絡先 */}
            <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="font-semibold">連絡先</dt>
              <dd className="sm:col-span-2 text-muted-foreground">
                [要設定]
                <br />
                <span className="text-xs">
                  ※お問い合わせはメールにて受け付けております
                </span>
              </dd>
            </div>

            {/* サービス名 */}
            <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="font-semibold">サービス名</dt>
              <dd className="sm:col-span-2">Threads Auto</dd>
            </div>

            {/* サービス内容 */}
            <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="font-semibold">サービス内容</dt>
              <dd className="sm:col-span-2">
                Threads投稿の自動化・スケジュール管理・AI支援コンテンツ生成・アナリティクスを提供するSaaS型Webサービス
              </dd>
            </div>

            {/* 販売価格 */}
            <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="font-semibold">販売価格</dt>
              <dd className="sm:col-span-2">
                <ul className="space-y-1">
                  <li>
                    <span className="font-medium">Freeプラン:</span> 月額
                    ¥0（無料）
                  </li>
                  <li>
                    <span className="font-medium">Proプラン:</span> 月額
                    ¥1,980（税込）
                  </li>
                  <li>
                    <span className="font-medium">Businessプラン:</span>{" "}
                    月額 ¥4,980（税込）
                  </li>
                </ul>
              </dd>
            </div>

            {/* 販売価格以外の費用 */}
            <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="font-semibold">販売価格以外に必要な費用</dt>
              <dd className="sm:col-span-2">
                インターネット接続に必要な通信料はお客様のご負担となります。
              </dd>
            </div>

            {/* 支払方法 */}
            <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="font-semibold">支払方法</dt>
              <dd className="sm:col-span-2">
                クレジットカード（Stripe Inc.による決済処理）
                <br />
                <span className="text-xs text-muted-foreground">
                  Visa, Mastercard, American Express, JCB, Diners Club
                </span>
              </dd>
            </div>

            {/* 支払時期 */}
            <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="font-semibold">支払時期</dt>
              <dd className="sm:col-span-2">
                月額課金制（初回決済は申込時、以降は毎月同日に自動更新）
              </dd>
            </div>

            {/* サービス提供時期 */}
            <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="font-semibold">サービス提供時期</dt>
              <dd className="sm:col-span-2">
                決済完了後、即時ご利用いただけます。
              </dd>
            </div>

            {/* 返品・キャンセル */}
            <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="font-semibold">返品・キャンセルについて</dt>
              <dd className="sm:col-span-2">
                <ul className="list-disc space-y-1 pl-4">
                  <li>サブスクリプションはいつでもキャンセル可能です。</li>
                  <li>
                    キャンセル後も、現在の請求期間の終了までサービスをご利用いただけます。
                  </li>
                  <li>日割り計算による返金は行っておりません。</li>
                  <li>
                    Freeプランへのダウングレードは、現在の請求期間終了時に適用されます。
                  </li>
                </ul>
              </dd>
            </div>

            {/* 動作環境 */}
            <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="font-semibold">動作環境</dt>
              <dd className="sm:col-span-2">
                <p>以下のモダンブラウザの最新版に対応しています。</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  <li>Google Chrome</li>
                  <li>Mozilla Firefox</li>
                  <li>Apple Safari</li>
                  <li>Microsoft Edge</li>
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  ※ JavaScript を有効にする必要があります。
                  <br />※ モバイルブラウザでもご利用いただけますが、デスクトップブラウザでの利用を推奨します。
                </p>
              </dd>
            </div>

            {/* その他特記事項 */}
            <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4">
              <dt className="font-semibold">その他特記事項</dt>
              <dd className="sm:col-span-2">
                <ul className="list-disc space-y-1 pl-4">
                  <li>
                    本サービスはMeta社のThreads APIを利用しています。APIの仕様変更や停止により、
                    サービスの一部機能が制限される場合があります。
                  </li>
                  <li>
                    AI機能はAnthropic社のClaude APIを利用しています。
                  </li>
                  <li>
                    詳しい利用条件については
                    <a
                      href="/terms"
                      className="text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                      利用規約
                    </a>
                    をご確認ください。
                  </li>
                </ul>
              </dd>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
