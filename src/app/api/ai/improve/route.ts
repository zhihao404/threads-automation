import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { createDb } from "@/db";
import { session } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { improvePostSchema } from "@/lib/validations/ai";
import { improvePost } from "@/lib/ai/improve";

async function getAuthenticatedUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("better-auth.session_token")?.value;
  if (!sessionToken) return null;

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  const sessions = await db
    .select({ userId: session.userId })
    .from(session)
    .where(
      and(
        eq(session.token, sessionToken),
        sql`${session.expiresAt} > ${Math.floor(Date.now() / 1000)}`
      )
    )
    .limit(1);

  return sessions[0]?.userId ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parseResult = improvePostSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "入力内容に誤りがあります",
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const { env } = await getCloudflareContext({ async: true });

    if (!env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI機能が設定されていません。管理者にお問い合わせください。" },
        { status: 503 }
      );
    }

    const suggestions = await improvePost(
      env.ANTHROPIC_API_KEY,
      input.content,
      input.goal
    );

    return NextResponse.json({ suggestions });
  } catch (error: unknown) {
    console.error("POST /api/ai/improve error:", error);

    if (error && typeof error === "object" && "status" in error) {
      const apiError = error as { status: number };
      if (apiError.status === 429) {
        return NextResponse.json(
          { error: "リクエストが多すぎます。しばらく待ってからお試しください。" },
          { status: 429 }
        );
      }
    }

    const message =
      error instanceof Error ? error.message : "改善提案に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
