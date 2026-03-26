import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { threadsAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";

function getTokenStatus(
  expiresAt: Date
): "valid" | "expiring_soon" | "expired" {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  if (expiresAt < now) {
    return "expired";
  }
  if (expiresAt < threeDaysFromNow) {
    return "expiring_soon";
  }
  return "valid";
}

export async function GET() {
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

    const accounts = await db
      .select({
        id: threadsAccounts.id,
        threadsUserId: threadsAccounts.threadsUserId,
        username: threadsAccounts.username,
        displayName: threadsAccounts.displayName,
        profilePictureUrl: threadsAccounts.profilePictureUrl,
        biography: threadsAccounts.biography,
        isVerified: threadsAccounts.isVerified,
        tokenExpiresAt: threadsAccounts.tokenExpiresAt,
        createdAt: threadsAccounts.createdAt,
        updatedAt: threadsAccounts.updatedAt,
      })
      .from(threadsAccounts)
      .where(eq(threadsAccounts.userId, userId));

    const accountsWithStatus = accounts.map((account) => ({
      ...account,
      tokenStatus: getTokenStatus(account.tokenExpiresAt),
    }));

    return NextResponse.json({ accounts: accountsWithStatus });
  } catch (error) {
    console.error("GET /api/accounts error:", error);
    return NextResponse.json(
      { error: "アカウント情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}
