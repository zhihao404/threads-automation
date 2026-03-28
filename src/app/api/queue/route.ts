import { NextRequest, NextResponse } from "next/server";
import { posts, postQueue, threadsAccounts } from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { ulid } from "ulid";
import { getAuthenticatedAccountContext, getAuthContext } from "@/lib/auth-helpers";
import { apiError } from "@/lib/api-response";

/**
 * GET /api/queue?accountId=xxx
 * Returns queue items for the specified account, ordered by position.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return apiError("accountIdが必要です", 400);
    }

    const result = await getAuthenticatedAccountContext(accountId);
    if (result instanceof NextResponse) return result;
    const { db, env } = result;

    // Get queue items with post data, ordered by position
    const queueItems = await db
      .select({
        id: postQueue.id,
        position: postQueue.position,
        createdAt: postQueue.createdAt,
        postId: posts.id,
        postContent: posts.content,
        postMediaType: posts.mediaType,
        postMediaUrls: posts.mediaUrls,
        postStatus: posts.status,
        postTopicTag: posts.topicTag,
        postReplyControl: posts.replyControl,
        postCreatedAt: posts.createdAt,
        accountUsername: threadsAccounts.username,
        accountDisplayName: threadsAccounts.displayName,
      })
      .from(postQueue)
      .innerJoin(posts, eq(postQueue.postId, posts.id))
      .innerJoin(threadsAccounts, eq(postQueue.accountId, threadsAccounts.id))
      .where(eq(postQueue.accountId, accountId))
      .orderBy(asc(postQueue.position));

    // Get queue settings from KV
    const settingsKey = `queue:settings:${accountId}`;
    const settingsRaw = await env.CACHE.get(settingsKey);
    const settings = settingsRaw
      ? (JSON.parse(settingsRaw) as {
          intervalMinutes: number;
          isPaused: boolean;
          nextPublishAt: string | null;
        })
      : {
          intervalMinutes: 60,
          isPaused: false,
          nextPublishAt: null,
        };

    return NextResponse.json({ items: queueItems, settings });
  } catch (error) {
    console.error("GET /api/queue error:", error);
    return apiError("キューの取得に失敗しました", 500);
  }
}

/**
 * POST /api/queue
 * Add a post to the queue.
 * Body: { postId: string, accountId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      postId?: string;
      accountId?: string;
      position?: number;
    };
    const { postId, accountId, position: requestedPosition } = body;

    if (!postId || !accountId) {
      return apiError("postIdとaccountIdが必要です", 400);
    }

    const result = await getAuthenticatedAccountContext(accountId);
    if (result instanceof NextResponse) return result;
    const { db } = result;

    // Verify the post exists and belongs to this account
    const postRows = await db
      .select({ id: posts.id, status: posts.status, accountId: posts.accountId })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    const post = postRows[0];
    if (!post) {
      return apiError("投稿が見つかりません", 404);
    }

    if (post.accountId !== accountId) {
      return apiError("この投稿はこのアカウントに属していません", 400);
    }

    // Check if the post is already in the queue
    const existingQueue = await db
      .select({ id: postQueue.id })
      .from(postQueue)
      .where(eq(postQueue.postId, postId))
      .limit(1);

    if (existingQueue[0]) {
      return apiError("この投稿は既にキューに追加されています", 409);
    }

    // Determine position
    let nextPosition: number;
    if (requestedPosition !== undefined && requestedPosition >= 0) {
      nextPosition = requestedPosition;
    } else {
      // Add to end of queue
      const maxPositionResult = await db
        .select({ maxPos: sql<number>`COALESCE(MAX(${postQueue.position}), 0)` })
        .from(postQueue)
        .where(eq(postQueue.accountId, accountId));

      nextPosition = (maxPositionResult[0]?.maxPos ?? 0) + 1;
    }

    const now = new Date();
    const queueEntryId = ulid();

    // Batch: shift positions (if needed), insert queue entry, update post status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batchOps: any[] = [];

    if (requestedPosition !== undefined && requestedPosition >= 0) {
      batchOps.push(
        db
          .update(postQueue)
          .set({
            position: sql`${postQueue.position} + 1`,
          })
          .where(
            and(
              eq(postQueue.accountId, accountId),
              sql`${postQueue.position} >= ${nextPosition}`
            )
          )
      );
    }

    batchOps.push(
      db.insert(postQueue).values({
        id: queueEntryId,
        accountId,
        postId,
        position: nextPosition,
        createdAt: now,
      })
    );

    batchOps.push(
      db
        .update(posts)
        .set({ status: "queued", updatedAt: now })
        .where(eq(posts.id, postId))
    );

    await db.batch(batchOps as [typeof batchOps[0], ...typeof batchOps]);

    return NextResponse.json(
      { id: queueEntryId, position: nextPosition },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/queue error:", error);
    return apiError("キューへの追加に失敗しました", 500);
  }
}

/**
 * PATCH /api/queue
 * Reorder queue items.
 * Body: { items: [{ id: string, position: number }] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await getAuthContext();
    if (authResult instanceof NextResponse) return authResult;
    const { userId, db } = authResult;

    const body = (await request.json()) as {
      items?: Array<{ id: string; position: number }>;
    };
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return apiError("itemsが必要です", 400);
    }

    // Verify all queue items belong to accounts owned by this user
    const queueItemIds = items.map((item) => item.id);
    const queueRows = await db
      .select({
        queueId: postQueue.id,
        accountId: postQueue.accountId,
        accountUserId: threadsAccounts.userId,
      })
      .from(postQueue)
      .innerJoin(threadsAccounts, eq(postQueue.accountId, threadsAccounts.id))
      .where(
        sql`${postQueue.id} IN (${sql.join(
          queueItemIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );

    if (queueRows.length !== items.length) {
      return apiError("一部のキューアイテムが見つかりません", 404);
    }

    // Verify ownership
    for (const row of queueRows) {
      if (row.accountUserId !== userId) {
        return apiError("アクセス権がありません", 403);
      }
    }

    // Update all positions atomically using batch
    const updatePromises = items.map((item) =>
      db
        .update(postQueue)
        .set({ position: item.position })
        .where(eq(postQueue.id, item.id))
    );

    await db.batch(updatePromises as [typeof updatePromises[0], ...typeof updatePromises]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/queue error:", error);
    return apiError("キューの並び替えに失敗しました", 500);
  }
}

/**
 * DELETE /api/queue (clear all queue items for an account)
 * Body: { accountId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { accountId?: string };
    const { accountId } = body;

    if (!accountId) {
      return apiError("accountIdが必要です", 400);
    }

    const result = await getAuthenticatedAccountContext(accountId);
    if (result instanceof NextResponse) return result;
    const { db } = result;

    // Get all queue items for this account to update post statuses
    const queueItems = await db
      .select({ postId: postQueue.postId })
      .from(postQueue)
      .where(eq(postQueue.accountId, accountId));

    if (queueItems.length > 0) {
      const now = new Date();
      const postIds = queueItems.map((item) => item.postId);

      // Batch: update all posts back to draft + delete all queue items
      await db.batch([
        db
          .update(posts)
          .set({ status: "draft", updatedAt: now })
          .where(
            sql`${posts.id} IN (${sql.join(
              postIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          ),
        db.delete(postQueue).where(eq(postQueue.accountId, accountId)),
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/queue error:", error);
    return apiError("キューのクリアに失敗しました", 500);
  }
}
