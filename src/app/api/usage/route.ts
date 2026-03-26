import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { createDb } from "@/db";
import { session } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getUserPlan, getAllUsageStats, getCurrentPeriod } from "@/lib/plans/limits";

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
        sql`${session.expiresAt} > ${Math.floor(Date.now() / 1000)}`,
      ),
    )
    .limit(1);

  return sessions[0]?.userId ?? null;
}

/**
 * GET /api/usage
 * Returns all usage stats for the current user.
 */
export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    const [plan, usage] = await Promise.all([
      getUserPlan(db, userId),
      getAllUsageStats(db, userId),
    ]);

    const period = getCurrentPeriod();

    return NextResponse.json({
      plan,
      period,
      usage,
    });
  } catch (error) {
    console.error("GET /api/usage error:", error);
    return NextResponse.json(
      { error: "使用量の取得に失敗しました" },
      { status: 500 },
    );
  }
}
