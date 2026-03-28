import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { notifications, threadsAccounts } from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { apiError } from "@/lib/api-response";

// =============================================================================
// GET /api/notifications - List notifications for authenticated user
// Query params: limit (default 20), unreadOnly (default false)
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return apiError("認証が必要です", 401);
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    const { searchParams } = new URL(request.url);
    const parsedLimit = parseInt(searchParams.get("limit") || "20");
    const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 20 : Math.min(parsedLimit, 100);
    const parsedOffset = parseInt(searchParams.get("offset") || "0");
    const offset = isNaN(parsedOffset) || parsedOffset < 0 ? 0 : Math.min(parsedOffset, 10000);
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    // Get all account IDs for this user
    const userAccounts = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(eq(threadsAccounts.userId, userId));

    const accountIds = userAccounts.map((a) => a.id);
    if (accountIds.length === 0) {
      return NextResponse.json({ notifications: [], total: 0 });
    }

    // Build conditions
    const conditions = [
      sql`${notifications.accountId} IN (${sql.join(
        accountIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    ];

    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(whereClause);

    const total = countResult[0]?.count ?? 0;

    // Get notifications with account info
    const rows = await db
      .select({
        id: notifications.id,
        accountId: notifications.accountId,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        metadata: notifications.metadata,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
        accountUsername: threadsAccounts.username,
        accountDisplayName: threadsAccounts.displayName,
        accountProfilePicture: threadsAccounts.profilePictureUrl,
      })
      .from(notifications)
      .innerJoin(
        threadsAccounts,
        eq(notifications.accountId, threadsAccounts.id),
      )
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ notifications: rows, total });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return apiError("通知の取得に失敗しました", 500);
  }
}

// =============================================================================
// PATCH /api/notifications - Mark notifications as read (bulk)
// Body: { ids: string[] } or { markAllRead: true }
// =============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return apiError("認証が必要です", 401);
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    const body = await request.json();
    const { ids, markAllRead } = body as {
      ids?: string[];
      markAllRead?: boolean;
    };

    // Get all account IDs for this user
    const userAccounts = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(eq(threadsAccounts.userId, userId));

    const accountIds = userAccounts.map((a) => a.id);
    if (accountIds.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const accountCondition = sql`${notifications.accountId} IN (${sql.join(
      accountIds.map((id) => sql`${id}`),
      sql`, `,
    )})`;

    if (markAllRead) {
      // Mark all notifications as read for this user's accounts
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(accountCondition, eq(notifications.isRead, false)));

      return NextResponse.json({ success: true });
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Mark specific notifications as read (only if they belong to user's accounts)
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            accountCondition,
            inArray(notifications.id, ids),
          ),
        );

      return NextResponse.json({ success: true });
    }

    return apiError("ids または markAllRead を指定してください", 400);
  } catch (error) {
    console.error("PATCH /api/notifications error:", error);
    return apiError("通知の更新に失敗しました", 500);
  }
}
