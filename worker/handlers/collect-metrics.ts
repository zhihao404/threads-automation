// =============================================================================
// Metrics Collection Handler
// Collects post and profile insights from the Threads API
// =============================================================================

import { eq, and, desc, lt, sql } from "drizzle-orm";
import { ulid } from "ulid";
import type { MetricsJobMessage } from "../../src/lib/queue/types";
import type { Env } from "../types";
import { createWorkerDb } from "../db";
import { posts, postMetrics, accountMetrics, threadsAccounts } from "../../src/db/schema";
import { decryptTokenWithKey } from "../crypto";
import { ThreadsClient } from "../threads-client";

/**
 * Collects metrics for all published posts and profile-level insights
 * for a given account.
 *
 * 1. Gets the account and decrypts the token
 * 2. Fetches all published posts for this account
 * 3. For each post, gets insights from the Threads API
 * 4. Upserts into postMetrics table
 * 5. Collects profile insights for the day and stores in accountMetrics
 */
export async function handleCollectMetrics(
  message: MetricsJobMessage,
  env: Env,
): Promise<void> {
  const db = createWorkerDb(env.DB);
  const now = new Date();

  // 1. Get account, decrypt token
  const accountRows = await db
    .select()
    .from(threadsAccounts)
    .where(eq(threadsAccounts.id, message.accountId))
    .limit(1);

  const account = accountRows[0];
  if (!account) {
    console.error(`Account ${message.accountId} not found for metrics collection`);
    return;
  }

  let accessToken: string;
  try {
    accessToken = await decryptTokenWithKey(account.accessToken, env.ENCRYPTION_KEY);
  } catch (err) {
    console.error(`Failed to decrypt token for account ${message.accountId}:`, err);
    return;
  }

  // 2. Create ThreadsClient
  const client = new ThreadsClient(accessToken, account.threadsUserId);

  // 3. Get all published posts for this account
  const publishedPosts = await db
    .select({
      id: posts.id,
      threadsMediaId: posts.threadsMediaId,
    })
    .from(posts)
    .where(
      and(
        eq(posts.accountId, message.accountId),
        eq(posts.status, "published"),
      ),
    );

  // 4. For each post with a threadsMediaId, get insights
  let metricsCollected = 0;
  for (const post of publishedPosts) {
    if (!post.threadsMediaId) continue;

    try {
      const insights = await client.getPostInsights(post.threadsMediaId);

      await db.insert(postMetrics).values({
        id: ulid(),
        postId: post.id,
        views: insights.views,
        likes: insights.likes,
        replies: insights.replies,
        reposts: insights.reposts,
        quotes: insights.quotes,
        shares: insights.shares,
        fetchedAt: now,
      });

      metricsCollected++;
    } catch (err) {
      // Log but don't fail the entire job for one post's metrics
      console.error(
        `Failed to collect metrics for post ${post.id} (threads: ${post.threadsMediaId}):`,
        err,
      );
    }
  }

  // 5. Collect profile insights for the day
  try {
    const today = now.toISOString().split("T")[0]; // YYYY-MM-DD

    // Get insights for the past 24 hours
    const since = Math.floor(now.getTime() / 1000) - 86400; // 24 hours ago
    const until = Math.floor(now.getTime() / 1000);

    const profileInsights = await client.getProfileInsights({
      since,
      until,
    });

    // Parse profile insights into structured data
    const insightValues: Record<string, number> = {};
    for (const metric of profileInsights.data) {
      if (metric.values.length > 0) {
        insightValues[metric.name] = metric.values[0].value;
      }
    }

    // Check if we already have metrics for today
    const existingMetrics = await db
      .select()
      .from(accountMetrics)
      .where(
        and(
          eq(accountMetrics.accountId, message.accountId),
          eq(accountMetrics.date, today),
        ),
      )
      .limit(1);

    const metricsData = {
      views: insightValues["views"] ?? 0,
      likes: insightValues["likes"] ?? 0,
      replies: insightValues["replies"] ?? 0,
      reposts: insightValues["reposts"] ?? 0,
      quotes: insightValues["quotes"] ?? 0,
      followersCount: insightValues["followers_count"] ?? 0,
      fetchedAt: now,
    };

    if (existingMetrics[0]) {
      // Update existing record
      await db
        .update(accountMetrics)
        .set(metricsData)
        .where(eq(accountMetrics.id, existingMetrics[0].id));
    } else {
      // Insert new record
      await db.insert(accountMetrics).values({
        id: ulid(),
        accountId: message.accountId,
        date: today,
        ...metricsData,
      });
    }
  } catch (err) {
    console.error(
      `Failed to collect profile insights for account ${message.accountId}:`,
      err,
    );
  }

  // 6. Cleanup old postMetrics to prevent unbounded growth
  try {
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Step 1: Delete all postMetrics rows older than 90 days
    await db.run(sql`
      DELETE FROM post_metrics
      WHERE fetched_at < ${Math.floor(ninetyDaysAgo.getTime() / 1000)}
        AND post_id IN (
          SELECT id FROM posts WHERE account_id = ${message.accountId}
        )
    `);

    // Step 2: For rows between 30-90 days old, keep only the latest per day per post
    await db.run(sql`
      DELETE FROM post_metrics
      WHERE fetched_at >= ${Math.floor(ninetyDaysAgo.getTime() / 1000)}
        AND fetched_at < ${Math.floor(thirtyDaysAgo.getTime() / 1000)}
        AND post_id IN (
          SELECT id FROM posts WHERE account_id = ${message.accountId}
        )
        AND id NOT IN (
          SELECT id FROM (
            SELECT id,
              ROW_NUMBER() OVER (
                PARTITION BY post_id, DATE(fetched_at, 'unixepoch')
                ORDER BY fetched_at DESC
              ) AS rn
            FROM post_metrics
            WHERE fetched_at >= ${Math.floor(ninetyDaysAgo.getTime() / 1000)}
              AND fetched_at < ${Math.floor(thirtyDaysAgo.getTime() / 1000)}
              AND post_id IN (
                SELECT id FROM posts WHERE account_id = ${message.accountId}
              )
          ) WHERE rn = 1
        )
    `);

    console.log(`Cleaned up old post metrics for account ${message.accountId}`);
  } catch (err) {
    console.error(
      `Failed to clean up old post metrics for account ${message.accountId}:`,
      err,
    );
  }

  console.log(
    `Collected metrics for account ${message.accountId}: ${metricsCollected} post(s)`,
  );
}
