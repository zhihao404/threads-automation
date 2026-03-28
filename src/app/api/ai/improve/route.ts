import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";

import { improvePostSchema } from "@/lib/validations/ai";
import { improvePost } from "@/lib/ai/improve";
import { guardPlanLimit } from "@/lib/plans/guard";
import { incrementUsage } from "@/lib/plans/limits";
import { AIConfigurationError, resolveAIProvider } from "@/lib/ai/provider";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { apiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return apiError("認証が必要です", 401);
    }

    const body = await request.json();
    const parseResult = improvePostSchema.safeParse(body);

    if (!parseResult.success) {
      return apiError("入力内容に誤りがあります", 400);
    }

    const input = parseResult.data;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Rate limiting: 10 requests per minute
    const rateLimit = await checkRateLimit(db, userId, "ai/improve", 10, 60_000);
    if (!rateLimit.allowed) {
      return apiError(
        "リクエストが多すぎます。しばらく待ってからお試しください。",
        429,
        { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      );
    }

    // Check plan limit for AI generation
    const limitResponse = await guardPlanLimit(db, userId, "ai_generation");
    if (limitResponse) return limitResponse;

    let aiConfig;
    try {
      aiConfig = resolveAIProvider(env);
    } catch (error) {
      if (error instanceof AIConfigurationError) {
        return apiError(error.message, 503);
      }
      throw error;
    }

    if (!aiConfig) {
      return apiError("AI機能が設定されていません。管理者にお問い合わせください。", 503);
    }

    const suggestions = await improvePost(aiConfig, input.content, input.goal);

    await incrementUsage(db, userId, "ai_generation");

    return NextResponse.json({ suggestions });
  } catch (error: unknown) {
    console.error("POST /api/ai/improve error:", error);

    if (error && typeof error === "object" && "status" in error) {
      const apiErr = error as { status: number };
      if (apiErr.status === 429) {
        return apiError("リクエストが多すぎます。しばらく待ってからお試しください。", 429);
      }
    }

    return apiError("処理中にエラーが発生しました", 500);
  }
}
