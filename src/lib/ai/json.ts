export function extractJsonText(rawText: string): string {
  const trimmed = rawText.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return jsonMatch ? jsonMatch[1].trim() : trimmed;
}

export function parseJsonResponse<T>(
  rawText: string,
  invalidJsonMessage: string,
  missingJsonMessage: string
): T {
  const normalizedText = extractJsonText(rawText);

  try {
    return JSON.parse(normalizedText) as T;
  } catch {
    const objectMatch = normalizedText.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      throw new Error(missingJsonMessage);
    }

    try {
      return JSON.parse(objectMatch[0]) as T;
    } catch {
      throw new Error(invalidJsonMessage);
    }
  }
}
