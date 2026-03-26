import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { posts, postQueue, threadsAccounts } from "@/db/schema";
import { eq, and, sql, gt } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";

/**
 * DELETE /api/queue/[id]
 * Remove a single item from the queue.
 * Updates post status back to "draft" and reorders remaining items.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Get the queue item with account ownership check
    const queueRows = await db
      .select({
        id: postQueue.id,
        postId: postQueue.postId,
        accountId: postQueue.accountId,
        position: postQueue.position,
        accountUserId: threadsAccounts.userId,
      })
      .from(postQueue)
      .innerJoin(threadsAccounts, eq(postQueue.accountId, threadsAccounts.id))
      .where(eq(postQueue.id, id))
      .limit(1);

    const queueItem = queueRows[0];
    if (!queueItem) {
      return NextResponse.json(
        { error: "キューアイテムが見つかりません" },
        { status: 404 }
      );
    }

    if (queueItem.accountUserId !== userId) {
      return NextResponse.json(
        { error: "アクセス権がありません" },
        { status: 403 }
      );
    }

    const now = new Date();

    // Delete the queue item
    await db.delete(postQueue).where(eq(postQueue.id, id));

    // Update post status back to draft
    await db
      .update(posts)
      .set({ status: "draft", updatedAt: now })
      .where(eq(posts.id, queueItem.postId));

    // Close the position gap: decrement positions of items after the removed one
    await db
      .update(postQueue)
      .set({
        position: sql`${postQueue.position} - 1`,
      })
      .where(
        and(
          eq(postQueue.accountId, queueItem.accountId),
          gt(postQueue.position, queueItem.position)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/queue/[id] error:", error);
    return NextResponse.json(
      { error: "キューアイテムの削除に失敗しました" },
      { status: 500 }
    );
  }
}
