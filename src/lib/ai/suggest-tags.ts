import Anthropic from "@anthropic-ai/sdk";

export async function suggestTopicTags(
  apiKey: string,
  content: string,
  count?: number
): Promise<string[]> {
  const tagCount = Math.min(count ?? 5, 10);

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: `あなたはThreads（Meta社のSNS）のトピックタグを提案するアシスタントです。

## ルール
- 投稿内容に関連するトピックタグを提案してください。
- 各タグは50文字以内にしてください。
- #記号は含めないでください。
- 日本語のタグを優先しますが、英語のタグも混ぜて構いません。
- 人気がありそうなタグ、発見されやすいタグを優先してください。

## 出力形式
必ず以下のJSON形式のみで出力してください。
\`\`\`json
{
  "tags": ["タグ1", "タグ2", "タグ3"]
}
\`\`\``,
    messages: [
      {
        role: "user",
        content: `以下の投稿内容に適したトピックタグを${tagCount}件提案してください。

投稿内容:
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
    const parsed = JSON.parse(rawText) as { tags: string[] };
    if (Array.isArray(parsed.tags)) {
      return parsed.tags
        .map((tag: string) => tag.replace(/^#/, "").trim())
        .filter((tag: string) => tag.length > 0 && tag.length <= 50)
        .slice(0, tagCount);
    }
  } catch {
    // Try to find JSON object in the text
    const objectMatch = rawText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        const parsed = JSON.parse(objectMatch[0]) as { tags: string[] };
        if (Array.isArray(parsed.tags)) {
          return parsed.tags
            .map((tag: string) => tag.replace(/^#/, "").trim())
            .filter((tag: string) => tag.length > 0 && tag.length <= 50)
            .slice(0, tagCount);
        }
      } catch {
        // Fall through
      }
    }
  }

  return [];
}
