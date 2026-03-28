import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { getDashboardData } from "@/lib/dashboard/service";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    const { searchParams } = new URL(request.url);
    const accountIdParam = searchParams.get("accountId");
    const period = searchParams.get("period") || "7d";
    const result = await getDashboardData(db, userId, {
      accountId: accountIdParam,
      period,
    });

    if (result.status === "account_not_found") {
      return NextResponse.json(
        { error: "アカウントが見つかりません" },
        { status: 404 },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("GET /api/analytics/dashboard error:", error);
    return NextResponse.json(
      { error: "ダッシュボードデータの取得に失敗しました" },
      { status: 500 }
    );
  }
}
