import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { threadsAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptToken } from "@/lib/threads/encryption";
import { ThreadsClient } from "@/lib/threads/client";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";

const VALID_TYPES = ["country", "city", "age", "gender"] as const;
type DemographicType = (typeof VALID_TYPES)[number];

function isValidType(type: string): type is DemographicType {
  return VALID_TYPES.includes(type as DemographicType);
}

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
    const accountId = searchParams.get("accountId");
    const type = searchParams.get("type") || "country";

    if (!accountId) {
      return NextResponse.json(
        { error: "accountIdが必要です" },
        { status: 400 }
      );
    }

    if (!isValidType(type)) {
      return NextResponse.json(
        { error: "typeは country, city, age, gender のいずれかを指定してください" },
        { status: 400 }
      );
    }

    // Get the account with access token
    const accountRows = await db
      .select({
        id: threadsAccounts.id,
        threadsUserId: threadsAccounts.threadsUserId,
        accessToken: threadsAccounts.accessToken,
      })
      .from(threadsAccounts)
      .where(
        and(
          eq(threadsAccounts.id, accountId),
          eq(threadsAccounts.userId, userId)
        )
      )
      .limit(1);

    if (accountRows.length === 0) {
      return NextResponse.json(
        { error: "アカウントが見つかりません" },
        { status: 404 }
      );
    }

    const account = accountRows[0]!;

    // Decrypt access token
    const accessToken = await decryptToken(account.accessToken);
    const client = new ThreadsClient(accessToken, account.threadsUserId);

    // Fetch demographics from Threads API
    const demographics = await client.getFollowerDemographics(type);

    // Transform the response
    const results = demographics.total_value.results;
    const totalCount = results.reduce((sum, r) => sum + r.value, 0);

    const data = results
      .map((r) => ({
        label: r.dimension_values[0] || "不明",
        value: r.value,
        percentage:
          totalCount > 0
            ? Math.round((r.value / totalCount) * 10000) / 100
            : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return NextResponse.json({
      type,
      data,
      totalCount,
    });
  } catch (error) {
    console.error("GET /api/analytics/demographics error:", error);

    // Check if it's a "not enough followers" error
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (
      errorMessage.includes("100 followers") ||
      errorMessage.includes("follower_demographics")
    ) {
      return NextResponse.json(
        {
          error: "フォロワーデモグラフィクスには100フォロワー以上が必要です",
          code: "INSUFFICIENT_FOLLOWERS",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "デモグラフィクスの取得に失敗しました" },
      { status: 500 }
    );
  }
}
