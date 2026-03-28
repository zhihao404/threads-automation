# CLAUDE.md

## Project Overview

Threads (Meta) 投稿自動化・分析SaaSプラットフォーム。

## Key Documents

実装にあたり以下のドキュメントを必ず参照すること：

- **要件定義書**: `docs/requirements.md` - 技術スタック、機能要件、DB設計、API仕様
- **リサーチレポート**: `docs/threads-saas-research.md` - Threads API制約、設計原則、実装パターン、インフラ設計、セキュリティ、運用の実務ガイド

## Development Guidelines (from Research Report)

### Threads API Core Constraints
- 投稿上限: 24時間移動窓で250件/プロフィール
- 返信上限: 24時間移動窓で1,000件/プロフィール
- Graph APIレート制限: 4800 x インプレッション数(最低10) / 24h
- テキスト: 500文字、長文添付で最大10,000文字
- Topics(ハッシュタグ): 実質1つ/投稿
- メディアコンテナ: 作成後平均30秒待機→publish、24h未publishでEXPIRED

### Design Principles
1. API制約をUI/データモデルに焼き込む（後付け不可）
2. チーム運用（権限・承認・監査）を初期から中核にする
3. 規約対応（データ削除、ログ、同意）を初期から組み込む
4. 返信自動化は「半自動（AI案+承認+監査）」をデフォルトに
5. 重複投稿防止のためidempotency key（dedupe_key）を実装

### Implementation Patterns
- 投稿パイプラインはstate machine（IN_PROGRESS/FINISHED/PUBLISHED/EXPIRED/ERROR）
- メディア投稿: 30秒待機 → statusポーリング → バックオフ → EXPIRED時再作成
- エラー分類: 再試行可能(429/5xx) / 再試行不可(権限不足/入力違反) / 人の介入要
- トークン: 60日長期トークン、期限前自動refresh + 失敗時再認可導線
- Webhook: 署名検証(X-Hub-Signature-256) + 重複排除 + ポーリング再同期の併用

### Security Requirements
- アクセストークンはKMS等で暗号化保管（DB平文禁止）
- 監査ログにトークン/PII出力禁止
- Webhook署名検証必須
- データ削除コールバックURL実装必須（Meta規約要件）
- 非公式自動化（スクレイピング等）の禁止

## Tech Stack
- Next.js 15 (App Router) + TypeScript
- Cloudflare Workers (opennextjs-cloudflare) + D1 + Drizzle ORM
- Better Auth + shadcn/ui + Tailwind CSS v4
- Cloudflare Queues / Cron Triggers / R2 / KV
- Claude API (AI content generation)

## Commands
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run lint` - ESLint
