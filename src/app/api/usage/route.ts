import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";

import { getUserPlan, getAllUsageStats, getCurrentPeriod } from "@/lib/plans/limits";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";

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
