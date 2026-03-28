import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { notifications, threadsAccounts } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { apiError } from "@/lib/api-response";

/**
 * Verify a notification belongs to the authenticated user and return it.
 */
async function getOwnedNotification(
  notificationId: string,
  userId: string,
) {
  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  // Get all account IDs for this user
  const userAccounts = await db
    .select({ id: threadsAccounts.id })
    .from(threadsAccounts)
    .where(eq(threadsAccounts.userId, userId));

  const accountIds = userAccounts.map((a) => a.id);
  if (accountIds.length === 0) return null;

  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        sql`${notifications.accountId} IN (${sql.join(
          accountIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

// =============================================================================
// PATCH /api/notifications/[id] - Mark single notification as read
// =============================================================================

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return apiError("認証が必要です", 401);
    }

    const { id } = await params;
    const notification = await getOwnedNotification(id, userId);
    if (!notification) {
      return apiError("通知が見つかりません", 404);
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/notifications/[id] error:", error);
    return apiError("通知の更新に失敗しました", 500);
  }
}

// =============================================================================
// DELETE /api/notifications/[id] - Delete a notification
// =============================================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return apiError("認証が必要です", 401);
    }

    const { id } = await params;
    const notification = await getOwnedNotification(id, userId);
    if (!notification) {
      return apiError("通知が見つかりません", 404);
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    await db.delete(notifications).where(eq(notifications.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/notifications/[id] error:", error);
    return apiError("通知の削除に失敗しました", 500);
  }
}
