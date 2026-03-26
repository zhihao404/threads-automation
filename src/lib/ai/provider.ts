import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export type AIProvider = "anthropic" | "openai" | "gemini";

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export interface AITokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AITextGenerationOptions {
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
  jsonMode?: boolean;
}

export interface AITextGenerationResult {
  text: string;
  usage: AITokenUsage;
}

export class AIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigurationError";
  }
}

type AIEnvironment = Partial<
  Pick<
    CloudflareEnv,
    | "AI_PROVIDER"
    | "ANTHROPIC_API_KEY"
    | "ANTHROPIC_MODEL"
    | "GEMINI_API_KEY"
    | "GEMINI_MODEL"
    | "OPENAI_API_KEY"
    | "OPENAI_MODEL"
  >
>;

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

function normalizeProvider(
  value: string | undefined
): AIProvider | "auto" | undefined {
  if (!value) return undefined;

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "anthropic" ||
    normalized === "openai" ||
    normalized === "gemini"
  ) {
    return normalized;
  }
  if (normalized === "auto") {
    return normalized;
  }

  throw new AIConfigurationError(
    "AI_PROVIDER は 'anthropic'、'openai'、'gemini'、'auto' のいずれかを指定してください。"
  );
}

export function resolveAIProvider(env: AIEnvironment): AIProviderConfig {
  const preferredProvider = normalizeProvider(env.AI_PROVIDER);

  if (preferredProvider === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) {
      throw new AIConfigurationError(
        "AI_PROVIDER=anthropic が指定されていますが、ANTHROPIC_API_KEY が設定されていません。"
      );
    }

    return {
      provider: "anthropic",
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    };
  }

  if (preferredProvider === "openai") {
    if (!env.OPENAI_API_KEY) {
      throw new AIConfigurationError(
        "AI_PROVIDER=openai が指定されていますが、OPENAI_API_KEY が設定されていません。"
      );
    }

    return {
      provider: "openai",
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    };
  }

  if (preferredProvider === "gemini") {
    if (!env.GEMINI_API_KEY) {
      throw new AIConfigurationError(
        "AI_PROVIDER=gemini が指定されていますが、GEMINI_API_KEY が設定されていません。"
      );
    }

    return {
      provider: "gemini",
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    };
  }

  if (env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    };
  }

  if (env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    };
  }

  if (env.GEMINI_API_KEY) {
    return {
      provider: "gemini",
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    };
  }

  throw new AIConfigurationError(
    "AI機能が設定されていません。ANTHROPIC_API_KEY、OPENAI_API_KEY、GEMINI_API_KEY のいずれかを設定してください。"
  );
}

function extractAnthropicText(response: Anthropic.Message): string {
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AIからの応答が空です");
  }

  return textBlock.text.trim();
}

async function generateWithAnthropic(
  config: AIProviderConfig,
  options: AITextGenerationOptions
): Promise<AITextGenerationResult> {
  const client = new Anthropic({ apiKey: config.apiKey });

  const response = await client.messages.create({
    model: config.model,
    max_tokens: options.maxOutputTokens,
    system: options.systemPrompt,
    messages: [{ role: "user", content: options.userPrompt }],
  });

  return {
    text: extractAnthropicText(response),
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

async function generateWithOpenAI(
  config: AIProviderConfig,
  options: AITextGenerationOptions
): Promise<AITextGenerationResult> {
  const client = new OpenAI({ apiKey: config.apiKey });

  const response = await client.responses.create({
    model: config.model,
    instructions: options.systemPrompt,
    input: options.userPrompt,
    max_output_tokens: options.maxOutputTokens,
    ...(options.jsonMode
      ? {
          text: {
            format: {
              type: "json_object" as const,
            },
          },
        }
      : {}),
  });

  if (response.error) {
    throw new Error(response.error.message || "OpenAI API の呼び出しに失敗しました");
  }

  const text = response.output_text?.trim();
  if (!text) {
    throw new Error("AIからの応答が空です");
  }

  return {
    text,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
  };
}

async function generateWithGemini(
  config: AIProviderConfig,
  options: AITextGenerationOptions
): Promise<AITextGenerationResult> {
  const client = new GoogleGenAI({ apiKey: config.apiKey });

  const response = await client.models.generateContent({
    model: config.model,
    contents: options.userPrompt,
    config: {
      systemInstruction: options.systemPrompt,
      maxOutputTokens: options.maxOutputTokens,
      ...(options.jsonMode
        ? {
            responseMimeType: "application/json",
          }
        : {}),
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error("AIからの応答が空です");
  }

  return {
    text,
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

export async function generateAIText(
  config: AIProviderConfig,
  options: AITextGenerationOptions
): Promise<AITextGenerationResult> {
  if (config.provider === "anthropic") {
    return generateWithAnthropic(config, options);
  }

  if (config.provider === "openai") {
    return generateWithOpenAI(config, options);
  }

  return generateWithGemini(config, options);
}
