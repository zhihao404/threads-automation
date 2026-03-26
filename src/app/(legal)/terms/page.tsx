import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "利用規約 | Threads Auto",
  description: "Threads Autoの利用規約です。サービスをご利用いただく前に必ずお読みください。",
};

export default function TermsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">利用規約</h1>
        <p className="mt-2 text-muted-foreground">
          最終更新日: 2026年3月1日
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Threads Auto 利用規約</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 text-sm leading-relaxed text-foreground/90">
          <p>
            この利用規約（以下「本規約」）は、Threads Auto（以下「当サービス」）の利用条件を定めるものです。
            ユーザーの皆様（以下「ユーザー」）には、本規約に同意いただいた上で、当サービスをご利用いただきます。
          </p>

          <Separator />

          {/* 第1条 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">第1条（適用）</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                本規約は、ユーザーと当サービス運営者（以下「運営者」）との間の、当サービスの利用に関わる一切の関係に適用されます。
              </li>
              <li>
                運営者が当サービス上で掲載する個別規定や追加規定は、本規約の一部を構成するものとします。
              </li>
              <li>
                本規約と個別規定が矛盾する場合は、個別規定が優先して適用されるものとします。
              </li>
            </ol>
          </section>

          <Separator />

          {/* 第2条 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">第2条（定義）</h2>
            <p>本規約において、以下の用語は次の意味を有するものとします。</p>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                <strong>「当サービス」</strong>とは、運営者が提供するThreads投稿の自動化、スケジュール管理、
                AI支援によるコンテンツ生成、およびアナリティクス機能を含むSaaS型Webサービス「Threads Auto」を指します。
              </li>
              <li>
                <strong>「ユーザー」</strong>とは、本規約に同意の上、当サービスにアカウントを登録した個人または法人を指します。
              </li>
              <li>
                <strong>「Threadsアカウント」</strong>とは、Meta社が提供するThreadsプラットフォーム上のユーザーアカウントを指します。
              </li>
              <li>
                <strong>「コンテンツ」</strong>とは、ユーザーが当サービスを通じて作成、編集、または投稿するテキスト、画像、動画その他のデータを指します。
              </li>
            </ol>
          </section>

          <Separator />

          {/* 第3条 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">第3条（アカウント登録）</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                当サービスの利用を希望する方は、本規約に同意の上、運営者の定める方法によりアカウント登録を行うものとします。
              </li>
              <li>
                登録にあたり、正確かつ最新の情報を提供するものとし、虚偽の情報を提供してはなりません。
              </li>
              <li>
                ユーザーは、自己のアカウント情報（メールアドレス、パスワード等）を適切に管理する責任を負います。
              </li>
              <li>
                アカウントの第三者への譲渡、貸与、共有は禁止します。
              </li>
              <li>
                以下の場合、運営者はアカウント登録を拒否または取り消すことができます。
                <ul className="mt-1 list-disc space-y-1 pl-6">
                  <li>虚偽の情報を提供した場合</li>
                  <li>過去に本規約違反によりアカウントを停止された場合</li>
                  <li>その他、運営者が不適当と判断した場合</li>
                </ul>
              </li>
            </ol>
          </section>

          <Separator />

          {/* 第4条 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">第4条（利用料金と支払い）</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                当サービスは、以下のプランを提供します。
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  <li><strong>Freeプラン:</strong> 月額無料（機能制限あり）</li>
                  <li><strong>Proプラン:</strong> 月額1,980円（税込）</li>
                  <li><strong>Businessプラン:</strong> 月額4,980円（税込）</li>
                </ul>
              </li>
              <li>
                有料プランの決済は、Stripe Inc.が提供するクレジットカード決済サービスを通じて行われます。
              </li>
              <li>
                有料プランは月額課金制であり、毎月自動更新されます。
              </li>
              <li>
                プランのアップグレードは即時適用され、ダウングレードは現在の請求期間終了時に適用されます。
              </li>
              <li>
                運営者は、30日前までに通知した上で、料金を変更することができます。
              </li>
            </ol>
          </section>

          <Separator />

          {/* 第5条 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">第5条（禁止事項）</h2>
            <p>ユーザーは、当サービスの利用にあたり、以下の行為を行ってはなりません。</p>
            <ol className="list-decimal space-y-2 pl-6">
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>スパム、大量送信、自動フォロー等のThreadsプラットフォームの利用規約に違反する行為</li>
              <li>Meta社/Threads APIの利用規約に違反する行為</li>
              <li>運営者、他のユーザー、または第三者の知的財産権、肖像権、プライバシー等を侵害する行為</li>
              <li>当サービスのサーバーやネットワークに過度の負荷をかける行為</li>
              <li>当サービスの運営を妨害する行為</li>
              <li>不正アクセスまたはこれを試みる行為</li>
              <li>他のユーザーのアカウントを不正に利用する行為</li>
              <li>反社会的勢力等への利益供与</li>
              <li>当サービスを利用して、誹謗中傷、差別、ハラスメント等のコンテンツを投稿する行為</li>
              <li>AI生成コンテンツを人間が作成したものと偽って投稿する行為（各プラットフォームの方針に従ってください）</li>
              <li>その他、運営者が不適切と判断する行為</li>
            </ol>
          </section>

          <Separator />

          {/* 第6条 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">第6条（サービスの中断・停止）</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                運営者は、以下の場合、事前の通知なく当サービスの全部または一部を中断・停止することができます。
                <ul className="mt-1 list-disc space-y-1 pl-6">
                  <li>サーバー、通信回線等の設備の保守・点検を行う場合</li>
                  <li>Threads API、Stripe決済等の外部サービスの障害が発生した場合</li>
                  <li>地震、火災、停電等の不可抗力により提供が困難な場合</li>
                  <li>その他、運営者がサービスの中断・停止が必要と判断した場合</li>
                </ul>
              </li>
              <li>
                運営者は、サービスの中断・停止によりユーザーに生じた損害について、一切の責任を負いません。
              </li>
            </ol>
          </section>

          <Separator />

          {/* 第7条 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">第7条（知的財産権）</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                当サービスに関する知的財産権（ソフトウェア、デザイン、ロゴ等）は、運営者に帰属します。
              </li>
              <li>
                ユーザーが作成したコンテンツの著作権はユーザーに帰属します。ただし、運営者はサービス提供に必要な範囲で
                当該コンテンツを利用できるものとします。
              </li>
              <li>
                AI機能を利用して生成されたコンテンツの著作権の帰属については、適用される法令に従います。
              </li>
            </ol>
          </section>

          <Separator />

          {/* 第8条 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">第8条（免責事項）</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                当サービスは、Threads APIに依存しています。Meta社によるAPI仕様の変更、サービス停止等により
                当サービスの機能が制限または利用不能となる場合があります。
              </li>
              <li>
                AI（Claude API）を利用したコンテンツ生成機能について、生成されるコンテンツの正確性、適切性、
                完全性を保証するものではありません。
              </li>
              <li>
                ユーザーが当サービスを通じてThreadsに投稿したコンテンツに起因する一切の紛争・損害について、
                運営者は責任を負いません。
              </li>
              <li>
                予約投稿機能について、外部要因（ネットワーク障害、API制限等）により、指定時刻通りに投稿されない
                場合があります。
              </li>
              <li>
                当サービスの利用によりユーザーに生じた損害（逸失利益を含む）について、運営者の故意または重大な過失がある場合を除き、
                運営者は一切の責任を負いません。
              </li>
            </ol>
          </section>

          <Separator />

          {/* 第9条 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">第9条（利用制限）</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                各プランには利用上限が設けられています。上限を超えた利用はできません。
              </li>
              <li>
                不正利用や本規約違反が確認された場合、運営者はユーザーのアカウントを一時停止または永久停止する権利を有します。
              </li>
              <li>
                アカウント停止に伴う返金は行いません。
              </li>
            </ol>
          </section>

          <Separator />

          {/* 第10条 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">第10条（退会・解約）</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                ユーザーは、設定画面よりいつでもアカウントを削除し、退会することができます。
              </li>
              <li>
                有料プランの解約はいつでも可能です。解約した場合、現在の請求期間の終了まではサービスをご利用いただけます。
              </li>
              <li>
                日割り計算による返金は行いません。
              </li>
              <li>
                退会時には、当該ユーザーに紐づく全てのデータ（投稿データ、分析データ、テンプレート等）が削除されます。
                この操作は取り消すことができません。
              </li>
            </ol>
          </section>

          <Separator />

          {/* 第11条 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">第11条（規約の変更）</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                運営者は、必要に応じて本規約を変更することができます。
              </li>
              <li>
                重要な変更を行う場合は、変更の効力発生日の30日前までに、当サービス上または登録メールアドレスへの通知により
                ユーザーに告知します。
              </li>
              <li>
                変更後の規約の効力発生日以降に当サービスを利用した場合、変更後の規約に同意したものとみなします。
              </li>
            </ol>
          </section>

          <Separator />

          {/* 第12条 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">第12条（準拠法・管轄裁判所）</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                本規約の解釈にあたっては、日本法を準拠法とします。
              </li>
              <li>
                当サービスに関して紛争が生じた場合、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
              </li>
            </ol>
          </section>

          <Separator />

          {/* 第13条 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">第13条（お問い合わせ）</h2>
            <p>
              本規約に関するお問い合わせは、以下の窓口までご連絡ください。
            </p>
            <div className="rounded-lg border bg-muted/50 p-4">
              <p><strong>サービス名:</strong> Threads Auto</p>
              <p><strong>メール:</strong> [要設定] support@example.com</p>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
