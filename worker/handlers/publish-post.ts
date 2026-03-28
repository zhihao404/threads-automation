// =============================================================================
// Post Publishing Handler
// Handles the actual Threads API publishing for a single post
// =============================================================================

import { eq } from "drizzle-orm";
import type { PostJobMessage } from "../../src/lib/queue/types";
import type { Env } from "../types";
import { createWorkerDb } from "../db";
import { posts, threadsAccounts } from "../../src/db/schema";
import { decryptTokenWithKey } from "../crypto";
import { ThreadsClient } from "../threads-client";
import { getMediaType } from "../utils";

/** Maximum number of publish attempts before marking a post as failed */
const MAX_RETRIES = 3;

/** Retry delay schedule in seconds: 30s, 120s, 300s */
const RETRY_DELAYS = [30, 120, 300];

/**
 * Returns the retry delay in seconds for the given attempt number.
 * Falls back to the last delay value for attempts beyond the schedule.
 */
export function getRetryDelay(attempt: number): number {
  return RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]!;
}

/**
 * Publishes a post to Threads.
 *
 * 1. Fetches the post and account from D1
 * 2. Decrypts the access token
 * 3. Creates the appropriate media container based on mediaType
 * 4. Waits for container ready (video posts)
 * 5. Publishes the container
 * 6. Updates the post record with the published media ID and permalink
 * 7. On failure: re-throws to let Cloudflare Queues retry, or marks as "failed" on final attempt
 *
 * Retry management is delegated to Cloudflare Queues (max_retries in wrangler.toml).
 * The `queueAttempts` parameter comes from the queue message's `attempts` property
 * (1-based: 1 = first delivery, 2 = first retry, etc.).
 */
export async function handlePublishPost(
  message: PostJobMessage,
  env: Env,
  queueAttempts: number,
): Promise<void> {
  const db = createWorkerDb(env.DB);
  const now = new Date();

  // 1. Get the post from DB
  const postRows = await db
    .select()
    .from(posts)
    .where(eq(posts.id, message.postId))
    .limit(1);

  const post = postRows[0];
  if (!post) {
    console.error(`Post ${message.postId} not found, skipping`);
    return;
  }

  // Skip if already published or not in a publishable state
  if (post.status === "published") {
    console.log(`Post ${message.postId} already published, skipping`);
    return;
  }

  // 2. Get the account and decrypt token
  const accountRows = await db
    .select()
    .from(threadsAccounts)
    .where(eq(threadsAccounts.id, message.accountId))
    .limit(1);

  const account = accountRows[0];
  if (!account) {
    console.error(`Account ${message.accountId} not found, marking post as failed`);
    await db
      .update(posts)
      .set({
        status: "failed",
        errorMessage: "Account not found",
        updatedAt: now,
      })
      .where(eq(posts.id, message.postId));
    return;
  }

  let accessToken: string;
  try {
    accessToken = await decryptTokenWithKey(account.accessToken, env.ENCRYPTION_KEY);
  } catch (err) {
    console.error(`Failed to decrypt token for account ${message.accountId}:`, err);
    await db
      .update(posts)
      .set({
        status: "failed",
        errorMessage: "Failed to decrypt access token",
        updatedAt: now,
      })
      .where(eq(posts.id, message.postId));
    return;
  }

  // 3. Create ThreadsClient
  const client = new ThreadsClient(accessToken, account.threadsUserId);

  try {
    // 4. Based on mediaType, call appropriate create method
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
        // 5. Wait for video container to be ready
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

    // 6. Publish the container
    const publishResult = await client.publishPost(containerId);

    // 7. Get permalink
    let permalink: string | null = null;
    try {
      const threadPost = await client.getPost(publishResult.id);
      permalink = threadPost.permalink ?? null;
    } catch {
      // Permalink fetch is non-critical
    }

    // 8. Update post status to "published"
    await db
      .update(posts)
      .set({
        status: "published",
        threadsMediaId: publishResult.id,
        permalink,
        publishedAt: now,
        errorMessage: null,
        updatedAt: now,
      })
      .where(eq(posts.id, message.postId));

    console.log(`Post ${message.postId} published successfully as ${publishResult.id}`);
  } catch (error) {
    // 9. On failure: let Cloudflare Queues handle retries.
    // queueAttempts is 1-based (1 = first delivery), so the final attempt is MAX_RETRIES.
    const errorMessage =
      error instanceof Error ? error.message : "Unknown publishing error";
    const isFinalAttempt = queueAttempts >= MAX_RETRIES;

    if (isFinalAttempt) {
      // Final attempt exhausted — mark as permanently failed and do NOT re-throw
      // so the queue considers the message handled (won't go to DLQ for this reason).
      await db
        .update(posts)
        .set({
          status: "failed",
          retryCount: queueAttempts,
          errorMessage: `Failed after ${queueAttempts} attempts: ${errorMessage}`,
          updatedAt: now,
        })
        .where(eq(posts.id, message.postId));

      console.error(
        `Post ${message.postId} failed permanently after ${queueAttempts} attempts: ${errorMessage}`,
      );
    } else {
      // Not the final attempt — record the error and re-throw to let the queue retry
      await db
        .update(posts)
        .set({
          retryCount: queueAttempts,
          errorMessage,
          updatedAt: now,
        })
        .where(eq(posts.id, message.postId));

      throw error;
    }
  }
}
