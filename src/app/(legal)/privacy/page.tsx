import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "プライバシーポリシー | Threads Auto",
  description: "Threads Autoのプライバシーポリシーです。個人情報の取り扱いについてご確認ください。",
};

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">プライバシーポリシー</h1>
        <p className="mt-2 text-muted-foreground">
          最終更新日: 2026年3月1日
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Threads Auto プライバシーポリシー</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 text-sm leading-relaxed text-foreground/90">
          <p>
            Threads Auto（以下「当サービス」）は、ユーザーの個人情報の保護を重要な責務と認識し、
            以下の方針に基づき個人情報を取り扱います。
          </p>

          <Separator />

          {/* 個人情報の取得 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">1. 個人情報の取得</h2>
            <p>当サービスは、以下の個人情報を取得します。</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>アカウント情報:</strong> 氏名、メールアドレス、パスワード（ハッシュ化して保存）
              </li>
              <li>
                <strong>Threadsアカウント情報:</strong> Threadsユーザー名、表示名、プロフィール画像URL、
                アクセストークン（暗号化して保存）
              </li>
              <li>
                <strong>決済情報:</strong> Stripeを通じて処理されるクレジットカード情報
                （カード情報は当サービスのサーバーには保存されません）
              </li>
              <li>
                <strong>利用データ:</strong> 投稿データ、スケジュール設定、テンプレート、
                アナリティクスデータ、AI生成履歴
              </li>
              <li>
                <strong>技術情報:</strong> IPアドレス、ブラウザ情報（User Agent）、アクセスログ
              </li>
            </ul>
          </section>

          <Separator />

          {/* 個人情報の利用目的 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">2. 個人情報の利用目的</h2>
            <p>取得した個人情報は、以下の目的で利用します。</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>当サービスの提供・運営（投稿管理、スケジュール実行、アナリティクス表示等）</li>
              <li>ユーザー認証およびアカウント管理</li>
              <li>Threads APIを通じた投稿の作成・管理</li>
              <li>AI機能によるコンテンツ生成（Anthropic Claude APIまたはOpenAI APIへのテキストデータの送信）</li>
              <li>決済処理（Stripe経由）</li>
              <li>サービスの改善・新機能の開発</li>
              <li>利用状況の分析</li>
              <li>重要なお知らせ・サービス変更の通知</li>
              <li>お問い合わせへの対応</li>
              <li>不正利用の防止</li>
            </ul>
          </section>

          <Separator />

          {/* 第三者への提供 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">3. 第三者への提供</h2>
            <p>
              当サービスは、以下の場合を除き、ユーザーの個人情報を第三者に提供しません。
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Stripe Inc.:</strong> 決済処理のため、メールアドレスおよび請求に必要な情報を共有します。
                Stripeのプライバシーポリシーは{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  https://stripe.com/privacy
                </a>{" "}
                をご参照ください。
              </li>
              <li>
                <strong>Anthropic (Claude API):</strong> AI機能利用時に、ユーザーが入力したテキストデータを送信します。
                Anthropicのプライバシーポリシーは{" "}
                <a
                  href="https://www.anthropic.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  https://www.anthropic.com/privacy
                </a>{" "}
                をご参照ください。
              </li>
              <li>
                <strong>OpenAI:</strong> AI機能利用時に、ユーザーが入力したテキストデータを送信します。
                OpenAIのプライバシーポリシーは{" "}
                <a
                  href="https://openai.com/policies/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  https://openai.com/policies/privacy-policy
                </a>{" "}
                をご参照ください。
              </li>
              <li>
                <strong>Meta Platforms, Inc. (Threads API):</strong> 投稿の作成・取得・分析のため、
                ユーザーのコンテンツおよびアカウント情報をThreads APIを通じて送受信します。
              </li>
              <li>
                <strong>法令に基づく場合:</strong> 法令の規定に基づき開示が求められた場合。
              </li>
              <li>
                <strong>生命・身体・財産の保護:</strong> 人の生命、身体または財産の保護のために必要がある場合。
              </li>
            </ul>
          </section>

          <Separator />

          {/* Cookieの使用 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">4. Cookieの使用</h2>
            <p>当サービスは、以下の目的でCookieを使用します。</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>セッション管理:</strong> ログイン状態の維持のため、セッションCookieを使用します。
              </li>
              <li>
                <strong>セキュリティ:</strong> CSRF対策等のセキュリティ目的のCookieを使用します。
              </li>
            </ul>
            <p>
              当サービスは、広告目的やトラッキング目的のCookieは使用しません。
            </p>
          </section>

          <Separator />

          {/* データの保管 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">5. データの保管</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                ユーザーデータは、Cloudflare D1（データベース）およびCloudflare R2（メディアストレージ）に保管されます。
              </li>
              <li>
                データはCloudflareのグローバルネットワーク上に分散保管され、データの所在地域は
                Cloudflareのインフラストラクチャポリシーに従います。
              </li>
              <li>
                Threadsアカウントのアクセストークンは、AES暗号化を施して保存します。
              </li>
            </ul>
          </section>

          <Separator />

          {/* セキュリティ */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">6. セキュリティ</h2>
            <p>当サービスは、個人情報の保護のため、以下のセキュリティ対策を講じています。</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>全ての通信はHTTPS（TLS）により暗号化されています</li>
              <li>パスワードは不可逆なハッシュ関数により保存されます</li>
              <li>APIトークンは暗号化して保存されます</li>
              <li>セッション管理にはセキュアなトークンベースの認証を使用しています</li>
              <li>定期的なセキュリティレビューを実施しています</li>
            </ul>
          </section>

          <Separator />

          {/* データの削除 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">7. データの削除</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                ユーザーは、設定画面からアカウントを削除することで、保存されている個人情報の削除を要求できます。
              </li>
              <li>
                アカウント削除時には、以下のデータが完全に削除されます:
                <ul className="mt-1 list-disc space-y-1 pl-6">
                  <li>アカウント情報（氏名、メールアドレス等）</li>
                  <li>接続されたThreadsアカウント情報</li>
                  <li>投稿データおよびスケジュール設定</li>
                  <li>テンプレートおよびAI生成履歴</li>
                  <li>アナリティクスデータ</li>
                  <li>通知データ</li>
                </ul>
              </li>
              <li>
                Stripeに保存された決済情報については、Stripeのデータ保持ポリシーに従います。
              </li>
              <li>
                アクセスログ等の技術的なログデータは、運営上の必要性から一定期間保持される場合があります。
              </li>
            </ul>
          </section>

          <Separator />

          {/* アクセスログ */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">8. アクセスログ</h2>
            <p>
              当サービスは、サーバーへのアクセスログを記録しています。アクセスログには以下の情報が含まれます。
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>アクセス日時</li>
              <li>IPアドレス</li>
              <li>リクエストURL</li>
              <li>ブラウザ情報（User Agent）</li>
              <li>リファラー情報</li>
            </ul>
            <p>
              アクセスログは、サービスの安定運用、不正アクセスの検知、および統計的な分析に利用されます。
              個人を特定するためには使用しません。
            </p>
          </section>

          <Separator />

          {/* ポリシーの変更 */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">9. プライバシーポリシーの変更</h2>
            <ol className="list-decimal space-y-2 pl-6">
              <li>
                当サービスは、必要に応じて本プライバシーポリシーを変更することがあります。
              </li>
              <li>
                重要な変更を行う場合は、当サービス上での通知または登録メールアドレスへの連絡により、
                ユーザーに告知します。
              </li>
              <li>
                変更後のプライバシーポリシーは、当サービス上に掲載した時点から効力を生じるものとします。
              </li>
            </ol>
          </section>

          <Separator />

          {/* お問い合わせ */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">10. お問い合わせ</h2>
            <p>
              個人情報の取り扱いに関するお問い合わせは、以下の窓口までご連絡ください。
            </p>
            <div className="rounded-lg border bg-muted/50 p-4">
              <p><strong>サービス名:</strong> Threads Auto</p>
              <p><strong>メール:</strong> [要設定] privacy@example.com</p>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
