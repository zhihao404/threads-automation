# Threads Automation

Threads（Meta）への投稿を自動化するツールです。

## 概要

Threads Publishing APIを利用して、投稿の作成・スケジュール・管理を自動化します。

## 機能（予定）

- テキスト投稿の自動化
- 画像付き投稿
- スケジュール投稿
- 投稿テンプレート管理

## セットアップ

### 前提条件

- Meta Developer アカウント
- Threads API アクセストークン

### インストール

```bash
git clone https://github.com/zhihao404/threads-automation.git
cd threads-automation
```

### AI設定

AI機能は Anthropic / OpenAI のどちらでも利用できます。

- `ANTHROPIC_API_KEY`: Anthropic を使う場合に設定
- `OPENAI_API_KEY`: OpenAI を使う場合に設定
- `AI_PROVIDER`: `anthropic` / `openai` / `auto`
- `ANTHROPIC_MODEL`: 任意。未指定時は `claude-sonnet-4-6`
- `OPENAI_MODEL`: 任意。未指定時は `gpt-5-mini`

`AI_PROVIDER` 未指定時は `ANTHROPIC_API_KEY` を優先し、未設定なら `OPENAI_API_KEY` を使用します。

詳細なセットアップ手順は今後追加予定です。

## ライセンス

MIT
