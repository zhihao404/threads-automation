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
import { getMediaType } from "../utils";

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

  // 3. Publish it
  const client = new ThreadsClient(accessToken, account.threadsUserId);

  try {
    // Update post status to publishing
    await db
      .update(posts)
      .set({ status: "publishing", updatedAt: now })
      .where(eq(posts.id, queueItem.postId));

    let containerId: string;
    const mediaUrls: string[] = post.mediaUrls ? JSON.parse(post.mediaUrls) : [];

    switch (post.mediaType) {
      case "TEXT":
        containerId = await client.createTextPost({
          text: post.content,
          replyControl: post.replyControl as "everyone" | "accounts_you_follow" | "mentioned_only",
          topicTag: post.topicTag ?? undefined,
        });
        break;

      case "IMAGE":
        if (!mediaUrls[0]) {
          throw new Error("Image post requires at least one media URL");
        }
        containerId = await client.createImagePost({
          text: post.content,
          imageUrl: mediaUrls[0],
          replyControl: post.replyControl as "everyone" | "accounts_you_follow" | "mentioned_only",
          topicTag: post.topicTag ?? undefined,
        });
        break;

      case "VIDEO":
        if (!mediaUrls[0]) {
          throw new Error("Video post requires at least one media URL");
        }
        containerId = await client.createVideoPost({
          text: post.content,
          videoUrl: mediaUrls[0],
          replyControl: post.replyControl as "everyone" | "accounts_you_follow" | "mentioned_only",
          topicTag: post.topicTag ?? undefined,
        });
        await client.waitForContainerReady(containerId);
        break;

      case "CAROUSEL":
        if (!mediaUrls || mediaUrls.length < 2) {
          throw new Error("Carousel post requires at least 2 media URLs");
        }
        containerId = await client.createCarouselPost({
          text: post.content,
          children: mediaUrls.map((url) => ({
            mediaType: getMediaType(url),
            url,
          })),
          replyControl: post.replyControl as "everyone" | "accounts_you_follow" | "mentioned_only",
          topicTag: post.topicTag ?? undefined,
        });
        break;

      default:
        throw new Error(`Unsupported media type: ${post.mediaType}`);
    }

    const publishResult = await client.publishPost(containerId);

    let permalink: string | null = null;
    try {
      const threadPost = await client.getPost(publishResult.id);
      permalink = threadPost.permalink ?? null;
    } catch {
      // Permalink fetch is non-critical
    }

    // Batch: update post status, remove from queue, update remaining positions
    await db.batch([
      db
        .update(posts)
        .set({
          status: "published",
          threadsMediaId: publishResult.id,
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

    console.log(
      `Queue item ${queueItem.id} processed: post ${queueItem.postId} published as ${publishResult.id}`,
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
