import Anthropic from "@anthropic-ai/sdk";

export interface ImprovementSuggestion {
  improved: string;
  explanation: string;
}

export async function improvePost(
  apiKey: string,
  content: string,
  goal?: string
): Promise<ImprovementSuggestion[]> {
  const client = new Anthropic({ apiKey });

  const goalText = goal || "全体的な改善";
  const goalDescriptions: Record<string, string> = {
    engagement: "エンゲージメント（いいね・リプライ・リポスト）を増やす",
    clarity: "メッセージをより明確でわかりやすくする",
    shorter: "より短く簡潔にまとめる",
    casual: "よりカジュアルで親しみやすいトーンにする",
    professional: "よりプロフェッショナルでビジネスライクなトーンにする",
  };

  const goalDescription = goalDescriptions[goal || ""] || goalText;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1536,
    system: `あなたはThreads（Meta社のSNS）の投稿を改善するプロのソーシャルメディアコンサルタントです。

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
    messages: [
      {
        role: "user",
        content: `以下のThreads投稿を改善してください。

改善の目標: ${goalDescription}

元の投稿:
${content}

JSON形式のみで回答してください。`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return [];
  }

  let rawText = textBlock.text.trim();

  // Extract JSON from markdown code block if present
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    rawText = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(rawText) as {
      suggestions: ImprovementSuggestion[];
    };
    if (Array.isArray(parsed.suggestions)) {
      return parsed.suggestions.map((s) => ({
        improved: s.improved.slice(0, 500),
        explanation: s.explanation,
      }));
    }
  } catch {
    // Try to find JSON object in the text
    const objectMatch = rawText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        const parsed = JSON.parse(objectMatch[0]) as {
          suggestions: ImprovementSuggestion[];
        };
        if (Array.isArray(parsed.suggestions)) {
          return parsed.suggestions.map((s) => ({
            improved: s.improved.slice(0, 500),
            explanation: s.explanation,
          }));
        }
      } catch {
        // Fall through
      }
    }
  }

  return [];
}
