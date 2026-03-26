import { parseJsonResponse } from "./json";
import { generateAIText, type AIProviderConfig } from "./provider";

export interface PostPerformanceData {
  content: string;
  mediaType: string;
  publishedAt: string;
  metrics: {
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
  };
}

export interface AccountOverview {
  totalPosts: number;
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
  followersCount: number;
  followersTrend: number;
  topPostsByViews: PostPerformanceData[];
  topPostsByEngagement: PostPerformanceData[];
  postsByHour: Record<number, number>;
  postsByDay: Record<number, number>;
}

export interface InsightResult {
  summary: string;
  strengths: string[];
  improvements: string[];
  bestTimes: { hour: number; day: string; reason: string }[];
  contentTips: string[];
  suggestedTopics: string[];
}

function buildInsightsSystemPrompt(): string {
  return `あなたはソーシャルメディア分析の専門家です。Threads（Meta社のSNS）のアカウントデータを分析し、実用的なインサイトを提供してください。

## ルール
- 日本語で回答してください。
- データに基づいた具体的で実行可能なアドバイスを提供してください。
- 抽象的な一般論ではなく、提供されたデータから読み取れる傾向を分析してください。
- 曜日は日本語で表記してください（月曜日、火曜日、...）

## 出力形式
必ず以下のJSON形式のみで出力してください。JSON以外のテキストは含めないでください。
\`\`\`json
{
  "summary": "全体的なパフォーマンスの要約（2-3文）",
  "strengths": ["強み1", "強み2", "強み3"],
  "improvements": ["改善点1", "改善点2", "改善点3"],
  "bestTimes": [
    { "hour": 12, "day": "月曜日", "reason": "理由" }
  ],
  "contentTips": ["具体的なコンテンツ戦略のヒント1", "ヒント2", "ヒント3", "ヒント4", "ヒント5"],
  "suggestedTopics": ["トピック1", "トピック2", "トピック3", "トピック4", "トピック5"]
}
\`\`\`

- strengths: 3-5項目、データから読み取れる強みを具体的に
- improvements: 3-5項目、改善できるポイントを具体的に
- bestTimes: 3-5項目、最適な投稿時間とその理由
- contentTips: 5項目、コンテンツ戦略のヒント
- suggestedTopics: 5-8項目、過去のパフォーマンスを基にしたトピック提案`;
}

function buildInsightsUserPrompt(data: AccountOverview): string {
  const dayNames = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];

  const postsByDayStr = Object.entries(data.postsByDay)
    .map(([day, count]) => `  ${dayNames[parseInt(day)]}: ${count}件`)
    .join("\n");

  const postsByHourStr = Object.entries(data.postsByHour)
    .map(([hour, count]) => `  ${hour}時: ${count}件`)
    .join("\n");

  const topViewsPosts = data.topPostsByViews
    .slice(0, 5)
    .map(
      (p, i) =>
        `  ${i + 1}. [${p.publishedAt}] views:${p.metrics.views}, likes:${p.metrics.likes}, replies:${p.metrics.replies}\n     "${p.content.slice(0, 100)}${p.content.length > 100 ? "..." : ""}"`
    )
    .join("\n");

  const topEngagementPosts = data.topPostsByEngagement
    .slice(0, 5)
    .map(
      (p, i) =>
        `  ${i + 1}. [${p.publishedAt}] views:${p.metrics.views}, likes:${p.metrics.likes}, replies:${p.metrics.replies}, reposts:${p.metrics.reposts}\n     "${p.content.slice(0, 100)}${p.content.length > 100 ? "..." : ""}"`
    )
    .join("\n");

  return `以下のThreadsアカウントのデータを分析し、インサイトを提供してください。

## アカウント概要
- 投稿数: ${data.totalPosts}件
- 平均閲覧数: ${data.avgViews}
- 平均いいね数: ${data.avgLikes}
- 平均リプライ数: ${data.avgReplies}
- フォロワー数: ${data.followersCount}
- フォロワー増減: ${data.followersTrend > 0 ? "+" : ""}${data.followersTrend}

## 曜日別投稿数
${postsByDayStr || "  データなし"}

## 時間帯別投稿数
${postsByHourStr || "  データなし"}

## 閲覧数トップ投稿
${topViewsPosts || "  データなし"}

## エンゲージメントトップ投稿
${topEngagementPosts || "  データなし"}

JSON形式のみで回答してください。`;
}

function parseInsightsResponse(rawText: string): InsightResult {
  const parsed = parseJsonResponse<InsightResult>(
    rawText,
    "AIの応答をJSONとして解析できませんでした",
    "AIの応答にJSONが見つかりませんでした"
  );

  if (!parsed.summary || !Array.isArray(parsed.strengths)) {
    throw new Error("AIの応答に必要なフィールドが含まれていません");
  }

  return {
    summary: parsed.summary,
    strengths: parsed.strengths || [],
    improvements: parsed.improvements || [],
    bestTimes: parsed.bestTimes || [],
    contentTips: parsed.contentTips || [],
    suggestedTopics: parsed.suggestedTopics || [],
  };
}

export async function generateInsights(
  config: AIProviderConfig,
  data: AccountOverview
): Promise<InsightResult> {
  const systemPrompt = buildInsightsSystemPrompt();
  const userPrompt = buildInsightsUserPrompt(data);

  const response = await generateAIText(config, {
    systemPrompt,
    userPrompt,
    maxOutputTokens: 2048,
    jsonMode: true,
  });

  return parseInsightsResponse(response.text);
}
