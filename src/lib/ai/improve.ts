import { parseJsonResponse } from "./json";
import { generateAIText, type AIProviderConfig } from "./provider";

export interface ImprovementSuggestion {
  improved: string;
  explanation: string;
}

export async function improvePost(
  config: AIProviderConfig,
  content: string,
  goal?: string
): Promise<ImprovementSuggestion[]> {
  const goalText = goal || "全体的な改善";
  const goalDescriptions: Record<string, string> = {
    engagement: "エンゲージメント（いいね・リプライ・リポスト）を増やす",
    clarity: "メッセージをより明確でわかりやすくする",
    shorter: "より短く簡潔にまとめる",
    casual: "よりカジュアルで親しみやすいトーンにする",
    professional: "よりプロフェッショナルでビジネスライクなトーンにする",
  };

  const goalDescription = goalDescriptions[goal || ""] || goalText;

  const response = await generateAIText(config, {
    systemPrompt: `あなたはThreads（Meta社のSNS）の投稿を改善するプロのソーシャルメディアコンサルタントです。

## ルール
- 改善案は必ず500文字以内にしてください。
- 元の投稿の意図やメッセージを保ちつつ改善してください。
- 各改善案には、なぜその変更が効果的かの説明を添えてください。
- 2〜3つの異なるアプローチの改善案を提示してください。

## 出力形式
必ず以下のJSON形式のみで出力してください。
\`\`\`json
{
  "suggestions": [
    {
      "improved": "改善された投稿テキスト",
      "explanation": "この改善が効果的な理由"
    }
  ]
}
\`\`\``,
    userPrompt: `以下のThreads投稿を改善してください。

改善の目標: ${goalDescription}

元の投稿:
${content}

JSON形式のみで回答してください。`,
    maxOutputTokens: 1536,
    jsonMode: true,
  });

  try {
    const parsed = parseJsonResponse<{ suggestions: ImprovementSuggestion[] }>(
      response.text,
      "AIの応答をJSONとして解析できませんでした",
      "AIの応答にJSONが見つかりませんでした"
    );

    if (Array.isArray(parsed.suggestions)) {
      return parsed.suggestions.map((s) => ({
        improved: s.improved.slice(0, 500),
        explanation: s.explanation,
      }));
    }
  } catch {
    return [];
  }

  return [];
}
