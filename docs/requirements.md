# Threads Automation - 要件定義書

**作成日:** 2026-03-26
**バージョン:** 1.0

---

## 1. プロジェクト概要

Threads (Meta) の投稿自動化・分析プラットフォーム。個人利用を起点とし、将来的にマルチテナントSaaSとしてリリースを目指す。

### 1.1 ゴール

- Threads投稿の作成・スケジュール・定期投稿を自動化
- AIによるコンテンツ生成で投稿作成を効率化
- 投稿パフォーマンスの分析・可視化によりエンゲージメントを最大化
- 複数Threadsアカウントの一元管理

---

## 2. 技術スタック

| レイヤー | 技術 | 選定理由 |
|---|---|---|
| **フレームワーク** | Next.js 15+ (App Router) | TypeScript、RSC、Server Actions |
| **デプロイ** | Cloudflare Workers (`opennextjs-cloudflare`) | 公式アダプタ、エッジ配信 |
| **データベース** | Cloudflare D1 + Drizzle ORM | 低レイテンシ、Workers統合、SQLite |
| **認証** | Better Auth | データ所有権、D1対応、エッジ互換 |
| **キュー** | Cloudflare Queues | 非同期処理（投稿公開、AI生成） |
| **定期実行** | Workers Cron Triggers | スケジュール・定期投稿のトリガー |
| **ストレージ** | Cloudflare R2 | 画像・動画アップロード（S3互換） |
| **キャッシュ** | Cloudflare KV | セッション、APIレスポンスキャッシュ |
| **UI** | shadcn/ui + Tailwind CSS v4 | コンポーネントライブラリ |
| **AI** | Anthropic Claude API | コンテンツ生成 |
| **監視** | Sentry + Cloudflare Analytics | エラー追跡、パフォーマンス |

### 2.1 技術選定の補足

- **D1を選択する理由**: Cloudflare Workersと同一ネットワーク上で動作し、レイテンシが最小。SaaS化時にもスケーラブル。スキーマが極端に複雑でなければD1で十分。
- **Better Authを選択する理由**: Clerk（外部サービス依存・コスト）よりデータ所有権を優先。Lucia（非推奨）の後継的ポジション。D1/Drizzle対応済み。
- **R2を選択する理由**: Threads APIは画像/動画を公開URLで指定する必要があるため、メディアホスティングにR2を使用。

---

## 3. Threads API 制約事項

要件設計にあたり、以下のAPI制約を前提とする。

| 制約 | 詳細 |
|---|---|
| **投稿文字数** | 最大500文字 |
| **投稿レート制限** | 250投稿/24時間（カルーセルは1投稿扱い） |
| **リプライレート制限** | 1,000リプライ/24時間 |
| **削除レート制限** | 100削除/24時間 |
| **ネイティブスケジューリング** | なし（自前実装が必要） |
| **投稿編集** | 不可（公開後の編集はAPIで未対応） |
| **メディアアップロード** | 直接アップロード不可。公開URLを指定 |
| **画像** | JPEG/PNG、最大8MB、320-1440px幅 |
| **動画** | MOV/MP4、最大1GB、最大5分 |
| **カルーセル** | 最小2枚、最大20枚 |
| **トピックタグ** | 1投稿につき1つまで |
| **コンテナ有効期限** | 作成後24時間で失効 |
| **トークン有効期限** | Long-lived: 60日（リフレッシュ可能） |
| **フォロワーデモグラフィクス** | 100フォロワー以上が必要 |
| **キーワード検索** | 500クエリ/7日間 |

---

## 4. 機能要件

### 4.1 認証・アカウント管理

#### F-AUTH-01: ユーザー認証
- Better Authによるメール/パスワード認証
- 将来的にGoogleソーシャルログイン追加

#### F-AUTH-02: Threadsアカウント連携
- Threads OAuth 2.0フローによるアカウント連携
- 複数Threadsアカウントの登録・管理
- Long-livedトークンの自動保存・暗号化
- トークンの自動リフレッシュ（期限前に自動更新）
- トークン期限切れ通知

#### F-AUTH-03: アカウント切り替え
- 連携済みアカウント一覧表示
- ワンクリックでのアクティブアカウント切り替え
- アカウントごとのプロフィール情報表示（アイコン、ユーザー名、認証バッジ）

---

### 4.2 投稿作成・管理

#### F-POST-01: テキスト投稿
- テキスト入力（500文字制限のリアルタイムカウンター）
- リンク添付（最大5つ、プレビューカード）
- トピックタグ設定（1つ）
- リプライコントロール設定（全員 / フォロー中 / メンションのみ）
- 投稿プレビュー

#### F-POST-02: メディア投稿
- 画像アップロード（JPEG/PNG、8MB制限）→ R2に保存 → 公開URLをAPIに渡す
- 動画アップロード（MOV/MP4、1GB制限）→ R2に保存 → 公開URLをAPIに渡す
- GIF添付（GIPHY連携）
- メディアプレビュー

#### F-POST-03: カルーセル投稿
- 複数メディア（2-20枚）の選択・並び替え
- ドラッグ&ドロップ対応
- 各メディアのプレビュー

#### F-POST-04: リプライ投稿
- 特定投稿へのリプライ作成
- スレッド形式（自分の投稿への連続リプライ）

#### F-POST-05: 投稿一覧・管理
- 公開済み投稿の一覧表示（タイムライン形式）
- 投稿の削除
- 投稿のパフォーマンス指標表示（views, likes, replies, reposts）
- フィルタリング（日付、メディアタイプ、パフォーマンス）

---

### 4.3 スケジュール・定期投稿

#### F-SCHED-01: スケジュール投稿
- 日時指定による予約投稿
- タイムゾーン選択
- スケジュール済み投稿の一覧表示
- スケジュール変更・キャンセル
- カレンダービュー（月/週表示）

#### F-SCHED-02: 定期投稿
- Cron式による繰り返しスケジュール設定
- UIでの簡易設定（毎日○時、毎週○曜日○時、等）
- 定期投稿テンプレートとの連携
- 一時停止・再開

#### F-SCHED-03: 投稿キュー
- キューに投稿を追加して順番に公開
- キュー内の順序変更（ドラッグ&ドロップ）
- 公開間隔の設定
- キューの一時停止・再開

---

### 4.4 AIコンテンツ生成

#### F-AI-01: 投稿文生成
- トピック/キーワードからの投稿文生成
- トーン指定（カジュアル、ビジネス、ユーモア等）
- 500文字制限内での自動調整
- 複数候補の生成・選択
- 生成後の手動編集

#### F-AI-02: 投稿テンプレート
- テンプレート作成・保存・管理
- 変数埋め込み（{{date}}, {{topic}} 等）
- AIによるテンプレートからの投稿文バリエーション生成
- カテゴリ分類

#### F-AI-03: コンテンツカレンダー提案
- AIによる投稿スケジュール提案
- トレンド・パフォーマンスデータに基づく最適投稿時間の提案
- 1週間/1ヶ月の投稿計画生成

#### F-AI-04: ハッシュタグ・トピックタグ提案
- 投稿内容に基づくトピックタグ提案
- トレンドタグの表示

---

### 4.5 分析・ダッシュボード

#### F-ANALYTICS-01: ダッシュボード
- 主要KPIのサマリーカード（views, likes, replies, reposts, quotes, followers）
- 期間比較（前週比、前月比）
- トレンドグラフ（日別/週別/月別）

#### F-ANALYTICS-02: 投稿パフォーマンス分析
- 投稿ごとの詳細メトリクス
- ベストパフォーマンス投稿ランキング
- メディアタイプ別パフォーマンス比較
- 投稿時間帯別パフォーマンスヒートマップ

#### F-ANALYTICS-03: フォロワー分析
- フォロワー数の推移グラフ
- フォロワーデモグラフィクス（国、都市、年齢、性別）
  - ※ 100フォロワー以上で利用可能
- フォロワー増減の要因分析（どの投稿がフォロワー増加に貢献したか）

#### F-ANALYTICS-04: エンゲージメント分析
- エンゲージメント率の推移
- リプライ・リポスト・引用の傾向分析
- URL click-through分析
- シェア数の分析

#### F-ANALYTICS-05: AIインサイト
- AIによるパフォーマンスサマリー生成
- 改善提案（投稿頻度、投稿時間、コンテンツタイプ）
- 週次/月次レポートの自動生成

---

### 4.6 リプライ管理

#### F-REPLY-01: リプライ一覧
- 自分の投稿へのリプライ一覧表示
- 未読/既読管理
- フィルタリング（投稿別、日付）

#### F-REPLY-02: リプライ管理アクション
- リプライの非表示/表示
- リプライ承認フロー（承認制リプライ設定時）

---

## 5. 非機能要件

### 5.1 パフォーマンス
- ページロード: 初回表示 < 2秒（エッジキャッシュ活用）
- API応答: < 500ms（DB操作含む）
- ダッシュボードのグラフ描画: < 1秒

### 5.2 セキュリティ
- Threads APIトークンのAES-256暗号化保存
- CSRFトークン検証
- レート制限（API・認証エンドポイント）
- 入力バリデーション・サニタイゼーション
- Content Security Policy (CSP)ヘッダー

### 5.3 可用性
- Cloudflareのグローバルネットワークによる高可用性
- エラー時のグレースフルデグラデーション
- 投稿キューのリトライ機構（最大3回）

### 5.4 スケーラビリティ
- SaaS化を見据えたマルチテナント設計
- DB設計時にテナント分離を考慮
- アカウント数・投稿数の増加に対応可能な設計

### 5.5 監視・ログ
- Sentryによるエラートラッキング
- 構造化ログ（JSON形式）
- Threads APIのレート制限消費状況の監視
- トークン期限切れアラート

---

## 6. 画面構成

```
/                     → ランディングページ（将来SaaS用）
/login                → ログイン
/register             → ユーザー登録
/dashboard            → ダッシュボード（メインKPI）
/dashboard/analytics  → 詳細分析
/dashboard/followers  → フォロワー分析
/posts                → 投稿一覧
/posts/new            → 新規投稿作成
/posts/schedule       → スケジュール管理（カレンダー）
/posts/queue          → 投稿キュー管理
/posts/templates      → テンプレート管理
/ai/generate          → AI投稿生成
/ai/calendar          → AIコンテンツカレンダー
/replies              → リプライ管理
/accounts             → アカウント管理
/settings             → 設定
```

---

## 7. データモデル（概要）

### users
アプリケーションのユーザー（Better Auth管理）

### threads_accounts
| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT (ULID) | PK |
| user_id | TEXT | FK → users |
| threads_user_id | TEXT | Threads API上のユーザーID |
| username | TEXT | Threadsユーザー名 |
| access_token | TEXT | 暗号化済みLong-livedトークン |
| token_expires_at | INTEGER | トークン有効期限 (UNIX timestamp) |
| profile_picture_url | TEXT | プロフィール画像URL |
| is_verified | INTEGER | 認証バッジの有無 |
| created_at | INTEGER | 作成日時 |
| updated_at | INTEGER | 更新日時 |

### posts
| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT (ULID) | PK |
| account_id | TEXT | FK → threads_accounts |
| threads_media_id | TEXT | Threads API上のメディアID（公開後） |
| content | TEXT | 投稿本文 |
| media_type | TEXT | TEXT / IMAGE / VIDEO / CAROUSEL |
| media_urls | TEXT | JSON配列（R2上のURL） |
| topic_tag | TEXT | トピックタグ |
| reply_control | TEXT | リプライコントロール設定 |
| status | TEXT | draft / scheduled / queued / publishing / published / failed |
| scheduled_at | INTEGER | スケジュール日時 |
| published_at | INTEGER | 公開日時 |
| error_message | TEXT | エラーメッセージ（失敗時） |
| created_at | INTEGER | 作成日時 |
| updated_at | INTEGER | 更新日時 |

### post_metrics
| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT (ULID) | PK |
| post_id | TEXT | FK → posts |
| views | INTEGER | 閲覧数 |
| likes | INTEGER | いいね数 |
| replies | INTEGER | リプライ数 |
| reposts | INTEGER | リポスト数 |
| quotes | INTEGER | 引用数 |
| shares | INTEGER | シェア数 |
| fetched_at | INTEGER | 取得日時 |

### account_metrics
| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT (ULID) | PK |
| account_id | TEXT | FK → threads_accounts |
| date | TEXT | 日付 (YYYY-MM-DD) |
| views | INTEGER | 閲覧数 |
| likes | INTEGER | いいね数 |
| replies | INTEGER | リプライ数 |
| reposts | INTEGER | リポスト数 |
| quotes | INTEGER | 引用数 |
| clicks | INTEGER | URLクリック数 |
| followers_count | INTEGER | フォロワー数 |

### recurring_schedules
| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT (ULID) | PK |
| account_id | TEXT | FK → threads_accounts |
| template_id | TEXT | FK → post_templates (nullable) |
| cron_expression | TEXT | Cron式 |
| timezone | TEXT | タイムゾーン |
| is_active | INTEGER | 有効/無効 |
| last_run_at | INTEGER | 最終実行日時 |
| next_run_at | INTEGER | 次回実行日時 |
| created_at | INTEGER | 作成日時 |

### post_templates
| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT (ULID) | PK |
| user_id | TEXT | FK → users |
| name | TEXT | テンプレート名 |
| content | TEXT | テンプレート本文（変数含む） |
| category | TEXT | カテゴリ |
| media_type | TEXT | メディアタイプ |
| created_at | INTEGER | 作成日時 |
| updated_at | INTEGER | 更新日時 |

### post_queue
| カラム | 型 | 説明 |
|---|---|---|
| id | TEXT (ULID) | PK |
| account_id | TEXT | FK → threads_accounts |
| post_id | TEXT | FK → posts |
| position | INTEGER | キュー内の順序 |
| interval_minutes | INTEGER | 公開間隔（分） |

---

## 8. システムアーキテクチャ

```
┌──────────────────────────────────────────────────────────┐
│                    Cloudflare Network                     │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────┐  │
│  │  Next.js App │    │ Cron Worker  │    │   Queues   │  │
│  │  (Workers)   │───▶│ (scheduled)  │───▶│ (async)    │  │
│  └──────┬───────┘    └──────────────┘    └─────┬──────┘  │
│         │                                      │         │
│  ┌──────┴───────┐    ┌──────────────┐    ┌─────┴──────┐  │
│  │     D1       │    │      KV      │    │     R2     │  │
│  │  (Database)  │    │   (Cache)    │    │  (Media)   │  │
│  └──────────────┘    └──────────────┘    └────────────┘  │
└──────────────────────────────────────────────────────────┘
          │                                      │
          ▼                                      ▼
┌──────────────────┐              ┌──────────────────────┐
│  Threads API     │              │   Claude API         │
│  (Meta Graph)    │              │   (AI生成)           │
└──────────────────┘              └──────────────────────┘
```

### 8.1 フロー詳細

**スケジュール投稿フロー:**
1. ユーザーが投稿を作成し、日時を指定
2. posts テーブルに `status=scheduled` で保存
3. Cron Worker が毎分実行、`scheduled_at <= now` の投稿を検索
4. Cloudflare Queues に投稿ジョブを送信
5. Queue Consumer が Threads API でコンテナ作成 → 公開
6. 成功: `status=published` に更新、メトリクス取得開始
7. 失敗: `status=failed`、リトライ（最大3回）

**AI生成フロー:**
1. ユーザーがトピック・トーン等を指定
2. Cloudflare Queues にAI生成ジョブを送信
3. Queue Consumer が Claude API で生成
4. 生成結果をユーザーに返却（WebSocket or ポーリング）
5. ユーザーが選択・編集後に投稿

**メトリクス収集フロー:**
1. Cron Worker が定期実行（1時間ごと）
2. 各アカウントの公開済み投稿のメトリクスを取得
3. post_metrics, account_metrics テーブルに保存
4. ダッシュボードでリアルタイム表示

---

## 9. 開発フェーズ

### Phase 1: 基盤構築（MVP）
- [ ] プロジェクトセットアップ（Next.js + Cloudflare Workers）
- [ ] データベーススキーマ設計・マイグレーション（D1 + Drizzle）
- [ ] ユーザー認証（Better Auth）
- [ ] Threads OAuth連携（アカウント接続）
- [ ] テキスト投稿（即座に公開）
- [ ] 投稿一覧表示
- [ ] 基本UI（shadcn/ui）

### Phase 2: スケジュール・メディア
- [ ] 画像/動画アップロード（R2）
- [ ] メディア投稿・カルーセル投稿
- [ ] スケジュール投稿（Cron Worker + Queues）
- [ ] スケジュールカレンダービュー
- [ ] 投稿キュー

### Phase 3: AI・テンプレート
- [ ] AI投稿文生成（Claude API）
- [ ] 投稿テンプレート管理
- [ ] 定期投稿（Recurring Schedule）
- [ ] トピックタグ提案

### Phase 4: 分析・ダッシュボード
- [ ] メトリクス収集（Cron）
- [ ] ダッシュボード（KPI サマリー）
- [ ] 投稿パフォーマンス分析
- [ ] フォロワー分析
- [ ] エンゲージメント分析グラフ
- [ ] 投稿時間帯ヒートマップ

### Phase 5: 高度な機能
- [ ] AIインサイト・改善提案
- [ ] 週次/月次レポート自動生成
- [ ] リプライ管理
- [ ] Webhook連携（リプライ・メンション通知）
- [ ] コンテンツカレンダー提案

### Phase 6: SaaS化
- [ ] マルチテナント対応
- [ ] ランディングページ
- [ ] 課金システム（Stripe）
- [ ] プラン管理（Free / Pro / Business）
- [ ] 利用規約・プライバシーポリシー

---

## 10. Threads API セットアップ手順

開発開始前に以下の準備が必要:

1. **Meta Developer アカウント作成**: https://developers.facebook.com/
2. **アプリ作成**: 「Threads」ユースケースを選択
3. **Threads API設定**:
   - リダイレクトURI設定（開発: `http://localhost:3000/api/auth/threads/callback`）
   - 必要な権限スコープの設定:
     - `threads_basic`
     - `threads_content_publish`
     - `threads_read_replies`
     - `threads_manage_replies`
     - `threads_manage_insights`
     - `threads_delete`
4. **テスター追加**: App Dashboard でテスターとしてThreadsアカウントを追加
5. **環境変数の設定**:
   ```
   THREADS_APP_ID=xxxxx
   THREADS_APP_SECRET=xxxxx
   ```

---

## 11. 補足: Threads API の未対応機能

以下はAPIで対応していないため、UIでの説明が必要:

- 投稿後の編集はできない（削除して再投稿の案内）
- DM送受信はAPI非対応
- リポスト（他者の投稿のシェア）はAPI非対応
- ホームフィードの取得は不可
- 他ユーザーの投稿取得は不可（キーワード検索のみ）
