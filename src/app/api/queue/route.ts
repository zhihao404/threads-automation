import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { posts, postQueue, threadsAccounts } from "@/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { ulid } from "ulid";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";

/**
 * GET /api/queue?accountId=xxx
 * Returns queue items for the specified account, ordered by position.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountIdが必要です" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Verify the account belongs to this user
    const accountRows = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(
        and(
          eq(threadsAccounts.id, accountId),
          eq(threadsAccounts.userId, userId)
        )
      )
      .limit(1);

    if (!accountRows[0]) {
      return NextResponse.json(
        { error: "アカウントが見つかりません" },
        { status: 404 }
      );
    }

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
    return NextResponse.json(
      { error: "キューの取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/queue
 * Add a post to the queue.
 * Body: { postId: string, accountId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      postId?: string;
      accountId?: string;
      position?: number;
    };
    const { postId, accountId, position: requestedPosition } = body;

    if (!postId || !accountId) {
      return NextResponse.json(
        { error: "postIdとaccountIdが必要です" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Verify the account belongs to this user
    const accountRows = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(
        and(
          eq(threadsAccounts.id, accountId),
          eq(threadsAccounts.userId, userId)
        )
      )
      .limit(1);

    if (!accountRows[0]) {
      return NextResponse.json(
        { error: "アカウントが見つかりません" },
        { status: 404 }
      );
    }

    // Verify the post exists and belongs to this account
    const postRows = await db
      .select({ id: posts.id, status: posts.status, accountId: posts.accountId })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    const post = postRows[0];
    if (!post) {
      return NextResponse.json(
        { error: "投稿が見つかりません" },
        { status: 404 }
      );
    }

    if (post.accountId !== accountId) {
      return NextResponse.json(
        { error: "この投稿はこのアカウントに属していません" },
        { status: 400 }
      );
    }

    // Check if the post is already in the queue
    const existingQueue = await db
      .select({ id: postQueue.id })
      .from(postQueue)
      .where(eq(postQueue.postId, postId))
      .limit(1);

    if (existingQueue[0]) {
      return NextResponse.json(
        { error: "この投稿は既にキューに追加されています" },
        { status: 409 }
      );
    }

    // Determine position
    let nextPosition: number;
    if (requestedPosition !== undefined && requestedPosition >= 0) {
      nextPosition = requestedPosition;
      // Shift existing items at or after this position
      await db
        .update(postQueue)
        .set({
          position: sql`${postQueue.position} + 1`,
        })
        .where(
          and(
            eq(postQueue.accountId, accountId),
            sql`${postQueue.position} >= ${nextPosition}`
          )
        );
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

    // Insert queue entry and update post status
    await db.insert(postQueue).values({
      id: queueEntryId,
      accountId,
      postId,
      position: nextPosition,
      createdAt: now,
    });

    await db
      .update(posts)
      .set({ status: "queued", updatedAt: now })
      .where(eq(posts.id, postId));

    return NextResponse.json(
      { id: queueEntryId, position: nextPosition },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/queue error:", error);
    return NextResponse.json(
      { error: "キューへの追加に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/queue
 * Reorder queue items.
 * Body: { items: [{ id: string, position: number }] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      items?: Array<{ id: string; position: number }>;
    };
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "itemsが必要です" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

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
      return NextResponse.json(
        { error: "一部のキューアイテムが見つかりません" },
        { status: 404 }
      );
    }

    // Verify ownership
    for (const row of queueRows) {
      if (row.accountUserId !== userId) {
        return NextResponse.json(
          { error: "アクセス権がありません" },
          { status: 403 }
        );
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
    return NextResponse.json(
      { error: "キューの並び替えに失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/queue (clear all queue items for an account)
 * Body: { accountId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as { accountId?: string };
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "accountIdが必要です" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Verify the account belongs to this user
    const accountRows = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(
        and(
          eq(threadsAccounts.id, accountId),
          eq(threadsAccounts.userId, userId)
        )
      )
      .limit(1);

    if (!accountRows[0]) {
      return NextResponse.json(
        { error: "アカウントが見つかりません" },
        { status: 404 }
      );
    }

    // Get all queue items for this account to update post statuses
    const queueItems = await db
      .select({ postId: postQueue.postId })
      .from(postQueue)
      .where(eq(postQueue.accountId, accountId));

    if (queueItems.length > 0) {
      const now = new Date();
      const postIds = queueItems.map((item) => item.postId);

      // Update all posts back to draft
      await db
        .update(posts)
        .set({ status: "draft", updatedAt: now })
        .where(
          sql`${posts.id} IN (${sql.join(
            postIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        );

      // Delete all queue items for this account
      await db.delete(postQueue).where(eq(postQueue.accountId, accountId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/queue error:", error);
    return NextResponse.json(
      { error: "キューのクリアに失敗しました" },
      { status: 500 }
    );
  }
}
