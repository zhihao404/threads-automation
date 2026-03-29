// =============================================================================
// Queue Processing Handler
// Processes the next item in the post queue for an account
// =============================================================================

import { eq, and, asc, sql } from "drizzle-orm";
import type { QueueJobMessage } from "../../src/lib/queue/types";
import type { Env } from "../types";
import { createWorkerDb } from "../db";
import { posts, postQueue, threadsAccounts } from "../../src/db/schema";
import { decryptTokenWithKey } from "../crypto";
import { ThreadsClient } from "../threads-client";
import { createMediaContainer, publishAndGetPermalink } from "../publish-helpers";
import {
  canPublish,
  canReply,
  recordPublish,
  recordReply,
  recordApiCall,
} from "../../src/lib/threads/rate-gate";

/**
 * Processes the next post in the queue for a given account.
 *
 * 1. Gets the next item in the queue (lowest position)
 * 2. Gets the associated post
 * 3. Publishes it using the Threads API
 * 4. Removes from queue on success
 * 5. Updates remaining queue positions
 */
export async function handleProcessQueue(
  message: QueueJobMessage,
  env: Env,
): Promise<void> {
  const db = createWorkerDb(env.DB);
  const now = new Date();

  // 1. Get the next item in the queue for this account (lowest position)
  const queueItems = await db
    .select()
    .from(postQueue)
    .where(eq(postQueue.accountId, message.accountId))
    .orderBy(asc(postQueue.position))
    .limit(1);

  const queueItem = queueItems[0];
  if (!queueItem) {
    console.log(`No queue items for account ${message.accountId}`);
    return;
  }

  // 2. Get the associated post
  const postRows = await db
    .select()
    .from(posts)
    .where(eq(posts.id, queueItem.postId))
    .limit(1);

  const post = postRows[0];
  if (!post) {
    // Post was deleted, remove the orphaned queue entry
    await db.delete(postQueue).where(eq(postQueue.id, queueItem.id));
    console.log(`Post ${queueItem.postId} not found, removed orphaned queue entry`);
    return;
  }

  // Skip if already published
  if (post.status === "published") {
    await db.delete(postQueue).where(eq(postQueue.id, queueItem.id));
    console.log(`Post ${queueItem.postId} already published, removed from queue`);
    return;
  }

  // Get the account and decrypt token
  const accountRows = await db
    .select()
    .from(threadsAccounts)
    .where(eq(threadsAccounts.id, message.accountId))
    .limit(1);

  const account = accountRows[0];
  if (!account) {
    console.error(`Account ${message.accountId} not found`);
    await db.delete(postQueue).where(eq(postQueue.id, queueItem.id));
    await db
      .update(posts)
      .set({ status: "failed", errorMessage: "Account not found", updatedAt: now })
      .where(eq(posts.id, queueItem.postId));
    return;
  }

  let accessToken: string;
  try {
    accessToken = await decryptTokenWithKey(account.accessToken, env.ENCRYPTION_KEY);
  } catch (err) {
    console.error(`Failed to decrypt token for account ${message.accountId}:`, err);
    await db
      .update(posts)
      .set({ status: "failed", errorMessage: "Failed to decrypt access token", updatedAt: now })
      .where(eq(posts.id, queueItem.postId));
    await db.delete(postQueue).where(eq(postQueue.id, queueItem.id));
    return;
  }

  // 3. Check Threads profile-level rate limits before publishing
  const isReply = !!post.replyToId;
  const quota = isReply
    ? await canReply(db, message.accountId)
    : await canPublish(db, message.accountId);

  if (!quota.allowed) {
    const kind = isReply ? "Reply" : "Post";
    const errorMsg = `${kind} rate limit exceeded (${quota.used}/${quota.limit} in 24h window)`;
    console.warn(`Queue item ${queueItem.id}: ${errorMsg}`);

    await db.batch([
      db
        .update(posts)
        .set({ status: "failed", errorMessage: errorMsg, updatedAt: now })
        .where(eq(posts.id, queueItem.postId)),
      db.delete(postQueue).where(eq(postQueue.id, queueItem.id)),
      db
        .update(postQueue)
        .set({ position: sql`${postQueue.position} - 1` })
        .where(
          and(
            eq(postQueue.accountId, message.accountId),
            sql`${postQueue.position} > ${queueItem.position}`,
          ),
        ),
    ]);
    return;
  }

  // 4. Publish it
  const client = new ThreadsClient(accessToken, account.threadsUserId);

  try {
    // Update post status to publishing
    await db
      .update(posts)
      .set({ status: "publishing", updatedAt: now })
      .where(eq(posts.id, queueItem.postId));

    // Create media container and publish
    const containerId = await createMediaContainer(client, post);
    const { id: publishedId, permalink } = await publishAndGetPermalink(client, containerId);

    // Batch: update post status, remove from queue, update remaining positions
    await db.batch([
      db
        .update(posts)
        .set({
          status: "published",
          threadsMediaId: publishedId,
          permalink,
          publishedAt: now,
          errorMessage: null,
          updatedAt: now,
        })
        .where(eq(posts.id, queueItem.postId)),
      db.delete(postQueue).where(eq(postQueue.id, queueItem.id)),
      db
        .update(postQueue)
        .set({
          position: sql`${postQueue.position} - 1`,
        })
        .where(
          and(
            eq(postQueue.accountId, message.accountId),
            sql`${postQueue.position} > ${queueItem.position}`,
          ),
        ),
    ]);

    // Record Threads profile-level usage for rate gate tracking
    if (isReply) {
      await recordReply(db, message.accountId);
    } else {
      await recordPublish(db, message.accountId);
    }
    await recordApiCall(db, message.accountId);

    console.log(
      `Queue item ${queueItem.id} processed: post ${queueItem.postId} published as ${publishedId}`,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown publishing error";

    // Batch: mark post as failed, remove from queue, decrement remaining positions
    await db.batch([
      db
        .update(posts)
        .set({
          status: "failed",
          errorMessage,
          retryCount: (post.retryCount ?? 0) + 1,
          updatedAt: now,
        })
        .where(eq(posts.id, queueItem.postId)),
      db.delete(postQueue).where(eq(postQueue.id, queueItem.id)),
      db
        .update(postQueue)
        .set({
          position: sql`${postQueue.position} - 1`,
        })
        .where(
          and(
            eq(postQueue.accountId, message.accountId),
            sql`${postQueue.position} > ${queueItem.position}`,
          ),
        ),
    ]);

    console.error(
      `Failed to process queue item ${queueItem.id} for post ${queueItem.postId}: ${errorMessage}`,
    );
  }
}
