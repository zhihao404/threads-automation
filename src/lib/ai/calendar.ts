import { format, addDays } from "date-fns";
import type { AccountOverview } from "./insights";
import { parseJsonResponse } from "./json";
import { generateAIText, type AIProviderConfig } from "./provider";

export interface CalendarSuggestion {
  date: string;
  time: string;
  topic: string;
  content: string;
  topicTag?: string;
  reasoning: string;
}

export interface CalendarParams {
  period: "week" | "2weeks" | "month";
  postsPerDay?: number;
  topics?: string[];
  tone?: string;
  accountData?: AccountOverview;
}

function getPeriodDays(period: CalendarParams["period"]): number {
  switch (period) {
    case "week":
      return 7;
    case "2weeks":
      return 14;
    case "month":
      return 30;
    default:
      return 7;
  }
}

function buildCalendarSystemPrompt(): string {
  return `あなたはソーシャルメディア戦略の専門家です。Threads（Meta社のSNS）のコンテンツカレンダーを作成してください。

## ルール
- 日本語でコンテンツを作成してください。
- 各投稿は必ず500文字以内に収めてください。
- バラエティに富んだコンテンツミックスを心がけてください。
- 時間帯は日本時間（JST）で指定してください。
- 一般的に高エンゲージメントが見込まれる時間帯を提案してください（朝7-9時、昼12-13時、夜20-22時）。
- 週末と平日で投稿の傾向を変えてください。
- トピックタグは#なしで提案してください。

## 出力形式
必ず以下のJSON形式のみで出力してください。JSON以外のテキストは含めないでください。
\`\`\`json
{
  "suggestions": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "topic": "投稿トピックの簡潔な説明",
      "content": "投稿の下書きテキスト（500文字以内）",
      "topicTag": "トピックタグ（#なし）",
      "reasoning": "この時間帯・トピックを選んだ理由"
    }
  ]
}
\`\`\``;
}

function buildCalendarUserPrompt(
  params: CalendarParams,
  startDate: Date,
  days: number
): string {
  const parts: string[] = [];

  const endDate = addDays(startDate, days - 1);
  parts.push(
    `以下の条件でThreadsのコンテンツカレンダーを作成してください。`
  );
  parts.push(
    `\n期間: ${format(startDate, "yyyy-MM-dd")} から ${format(endDate, "yyyy-MM-dd")} (${days}日間)`
  );
  parts.push(`1日あたりの投稿数: ${params.postsPerDay || 1}件`);

  if (params.topics && params.topics.length > 0) {
    parts.push(`\n希望トピック: ${params.topics.join("、")}`);
    parts.push(
      "これらのトピックを中心に、関連するバリエーションも含めてください。"
    );
  }

  if (params.tone) {
    const toneMap: Record<string, string> = {
      casual: "カジュアルで親しみやすい",
      professional: "プロフェッショナルで信頼感のある",
      humorous: "ユーモアのある楽しい",
      informative: "情報提供を重視した",
      inspiring: "インスピレーションを与える",
      provocative: "刺激的で議論を促す",
    };
    const toneDesc = toneMap[params.tone] || params.tone;
    parts.push(`\nトーン: ${toneDesc}`);
  }

  if (params.accountData) {
    const data = params.accountData;
    parts.push(`\n## アカウント情報（参考）`);
    parts.push(`- フォロワー数: ${data.followersCount}`);
    parts.push(`- 平均閲覧数: ${data.avgViews}`);
    parts.push(`- 平均いいね数: ${data.avgLikes}`);

    if (data.topPostsByEngagement.length > 0) {
      parts.push(`\n## 過去の人気投稿（参考）`);
      data.topPostsByEngagement.slice(0, 3).forEach((p, i) => {
        parts.push(
          `${i + 1}. "${p.content.slice(0, 80)}..." (views:${p.metrics.views}, likes:${p.metrics.likes})`
        );
      });
    }
  }

  parts.push(
    `\n合計 ${days * (params.postsPerDay || 1)}件の投稿を提案してください。各投稿は500文字以内にしてください。JSON形式のみで回答してください。`
  );

  return parts.join("\n");
}

function parseCalendarResponse(rawText: string): CalendarSuggestion[] {
  const parsed = parseJsonResponse<{ suggestions: CalendarSuggestion[] }>(
    rawText,
    "AIの応答をJSONとして解析できませんでした",
    "AIの応答にJSONが見つかりませんでした"
  );

  if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
    throw new Error("AIの応答にカレンダーデータが含まれていません");
  }

  return parsed.suggestions.map((s) => ({
    date: s.date,
    time: s.time,
    topic: s.topic,
    content: s.content.slice(0, 500),
    topicTag: s.topicTag ? s.topicTag.replace(/^#/, "").slice(0, 50) : undefined,
    reasoning: s.reasoning,
  }));
}

export async function generateContentCalendar(
  config: AIProviderConfig,
  params: CalendarParams
): Promise<CalendarSuggestion[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1); // Start from tomorrow
  const days = getPeriodDays(params.period);

  const systemPrompt = buildCalendarSystemPrompt();
  const userPrompt = buildCalendarUserPrompt(params, startDate, days);

  const response = await generateAIText(config, {
    systemPrompt,
    userPrompt,
    maxOutputTokens: 4096,
    jsonMode: true,
  });

  return parseCalendarResponse(response.text);
}
