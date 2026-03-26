import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { notifications, threadsAccounts } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";

// =============================================================================
// GET /api/notifications/count - Unread notification count
// Returns { unreadCount: number }
// =============================================================================

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

    // Get all account IDs for this user
    const userAccounts = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(eq(threadsAccounts.userId, userId));

    const accountIds = userAccounts.map((a) => a.id);
    if (accountIds.length === 0) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          sql`${notifications.accountId} IN (${sql.join(
            accountIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
          eq(notifications.isRead, false),
        ),
      );

    const unreadCount = result[0]?.count ?? 0;

    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error("GET /api/notifications/count error:", error);
    return NextResponse.json(
      { error: "未読数の取得に失敗しました" },
      { status: 500 },
    );
  }
}
