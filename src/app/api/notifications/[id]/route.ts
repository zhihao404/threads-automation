import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { notifications, threadsAccounts, session } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { cookies } from "next/headers";

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
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const notification = await getOwnedNotification(id, userId);
    if (!notification) {
      return NextResponse.json(
        { error: "通知が見つかりません" },
        { status: 404 },
      );
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
    return NextResponse.json(
      { error: "通知の更新に失敗しました" },
      { status: 500 },
    );
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
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const notification = await getOwnedNotification(id, userId);
    if (!notification) {
      return NextResponse.json(
        { error: "通知が見つかりません" },
        { status: 404 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    await db.delete(notifications).where(eq(notifications.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/notifications/[id] error:", error);
    return NextResponse.json(
      { error: "通知の削除に失敗しました" },
      { status: 500 },
    );
  }
}
