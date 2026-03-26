// =============================================================================
// Scheduled Worker - Cloudflare Cron Triggers & Queue Consumer
//
// This is a separate Cloudflare Worker that handles:
// 1. Cron-triggered scheduled tasks (checking for posts to publish, etc.)
// 2. Queue consumption (processing individual publish/metrics/token jobs)
// =============================================================================

import { eq, and, sql, lte } from "drizzle-orm";
import type { Env, JobMessageBatch } from "./types";
import type { JobMessage, PostJobMessage } from "../src/lib/queue/types";
import { createWorkerDb } from "./db";
import { posts, postQueue, threadsAccounts, recurringSchedules, postTemplates } from "../src/db/schema";
import { handlePublishPost, getRetryDelay } from "./handlers/publish-post";
import { handleProcessQueue } from "./handlers/process-queue";
import { handleCollectMetrics } from "./handlers/collect-metrics";
import { handleTokenRefresh } from "./handlers/refresh-token";
import { getNextRunTime } from "../src/lib/cron/parser";
import { renderTemplate, getBuiltinVariableValues } from "../src/lib/templates/render";
import { ulid } from "ulid";

// =============================================================================
// Cron Handlers
// =============================================================================

/**
 * Checks for posts with status "scheduled" and scheduledAt <= now.
 * Sends a publish_post job to the queue for each and updates status to "publishing".
 */
async function processScheduledPosts(env: Env): Promise<void> {
  const db = createWorkerDb(env.DB);
  const now = new Date();

  // Find posts that are scheduled and due
  const duePosts = await db
    .select({
      id: posts.id,
      accountId: posts.accountId,
    })
    .from(posts)
    .where(
      and(
        eq(posts.status, "scheduled"),
        lte(posts.scheduledAt, now),
      ),
    );

  if (duePosts.length === 0) return;

  console.log(`Found ${duePosts.length} scheduled post(s) due for publishing`);

  for (const post of duePosts) {
    // Update status to "publishing" to prevent duplicate processing (optimistic lock)
    const result = await db
      .update(posts)
      .set({ status: "publishing", updatedAt: now })
      .where(
        and(
          eq(posts.id, post.id),
          // Optimistic lock: only update if still in "scheduled" status
          eq(posts.status, "scheduled"),
        ),
      );

    // Only enqueue if we actually acquired the lock (another worker may have already claimed it)
    if (result.meta.changes === 0) {
      console.log(`Post ${post.id} already being processed by another worker, skipping`);
      continue;
    }

    // Send publish job to queue
    const message: PostJobMessage = {
      type: "publish_post",
      postId: post.id,
      accountId: post.accountId,
    };

    await env.POST_QUEUE.send(message);
    console.log(`Enqueued publish job for post ${post.id}`);
  }
}

/**
 * Checks the post queue for each account and triggers processing
 * for accounts with pending queue items.
 */
async function processPostQueue(env: Env): Promise<void> {
  const db = createWorkerDb(env.DB);

  // Get distinct accounts that have queue items
  const accountsWithQueue = await db
    .select({
      accountId: postQueue.accountId,
    })
    .from(postQueue)
    .groupBy(postQueue.accountId);

  if (accountsWithQueue.length === 0) return;

  for (const entry of accountsWithQueue) {
    // Check if the account has any posts currently being published
    // to avoid overwhelming the API with concurrent publishes
    const publishingPosts = await db
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          eq(posts.accountId, entry.accountId),
          eq(posts.status, "publishing"),
        ),
      )
      .limit(1);

    if (publishingPosts.length > 0) {
      // Account already has a post being published, skip
      continue;
    }

    await env.POST_QUEUE.send({
      type: "process_queue",
      accountId: entry.accountId,
    });

    console.log(`Enqueued queue processing for account ${entry.accountId}`);
  }
}

/**
 * Triggers metrics collection for all active accounts.
 */
async function triggerMetricsCollection(env: Env): Promise<void> {
  const db = createWorkerDb(env.DB);

  const activeAccounts = await db
    .select({ id: threadsAccounts.id })
    .from(threadsAccounts);

  for (const account of activeAccounts) {
    await env.POST_QUEUE.send({
      type: "collect_metrics",
      accountId: account.id,
    });
  }

  if (activeAccounts.length > 0) {
    console.log(`Enqueued metrics collection for ${activeAccounts.length} account(s)`);
  }
}

/**
 * Checks for accounts with tokens expiring within 7 days
 * and triggers a token refresh for each.
 */
async function triggerTokenRefresh(env: Env): Promise<void> {
  const db = createWorkerDb(env.DB);
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const expiringAccounts = await db
    .select({ id: threadsAccounts.id })
    .from(threadsAccounts)
    .where(lte(threadsAccounts.tokenExpiresAt, sevenDaysFromNow));

  for (const account of expiringAccounts) {
    await env.POST_QUEUE.send({
      type: "refresh_token",
      accountId: account.id,
    });
  }

  if (expiringAccounts.length > 0) {
    console.log(
      `Enqueued token refresh for ${expiringAccounts.length} account(s) with expiring tokens`,
    );
  }
}

/**
 * Processes recurring schedules that are due.
 * For each due schedule:
 * 1. Fetches the linked template (if any)
 * 2. Renders the template with built-in variables
 * 3. Creates a new post with status "scheduled" and scheduledAt = now
 * 4. Updates lastRunAt and computes the next nextRunAt
 */
async function processRecurringSchedules(env: Env): Promise<void> {
  const db = createWorkerDb(env.DB);
  const now = new Date();

  // Find all active recurring schedules that are due
  const dueSchedules = await db
    .select({
      id: recurringSchedules.id,
      accountId: recurringSchedules.accountId,
      templateId: recurringSchedules.templateId,
      cronExpression: recurringSchedules.cronExpression,
      timezone: recurringSchedules.timezone,
    })
    .from(recurringSchedules)
    .where(
      and(
        eq(recurringSchedules.isActive, true),
        lte(recurringSchedules.nextRunAt, now),
      ),
    );

  if (dueSchedules.length === 0) return;

  console.log(`Found ${dueSchedules.length} recurring schedule(s) due for processing`);

  for (const schedule of dueSchedules) {
    try {
      let content = "";
      let templateMediaType: "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL" | undefined;

      // Fetch and render template if set
      if (schedule.templateId) {
        const templateRows = await db
          .select({
            content: postTemplates.content,
            mediaType: postTemplates.mediaType,
          })
          .from(postTemplates)
          .where(eq(postTemplates.id, schedule.templateId))
          .limit(1);

        const template = templateRows[0];
        if (template) {
          const builtinVars = getBuiltinVariableValues();
          content = renderTemplate(template.content, builtinVars);
          templateMediaType = template.mediaType;
        }
      }

      // Only create a post if we have content
      if (content) {
        const postId = ulid();
        await db.insert(posts).values({
          id: postId,
          accountId: schedule.accountId,
          content,
          mediaType: templateMediaType || "TEXT",
          status: "scheduled",
          scheduledAt: now,
          createdAt: now,
          updatedAt: now,
        });

        console.log(
          `Created post ${postId} from recurring schedule ${schedule.id}`,
        );
      } else {
        console.log(
          `Skipped recurring schedule ${schedule.id}: no template or empty content`,
        );
      }

      // Update schedule timing regardless of whether a post was created
      const nextRunAt = getNextRunTime(
        schedule.cronExpression,
        schedule.timezone,
        now,
      );

      await db
        .update(recurringSchedules)
        .set({
          lastRunAt: now,
          nextRunAt,
          updatedAt: now,
        })
        .where(eq(recurringSchedules.id, schedule.id));
    } catch (error) {
      console.error(
        `Error processing recurring schedule ${schedule.id}:`,
        error,
      );
      // Continue processing other schedules
    }
  }
}

// =============================================================================
// Job Processing
// =============================================================================

/**
 * Routes a job message to the appropriate handler.
 * @param queueAttempts - The queue message's attempts count (1-based), used for retry decisions.
 */
async function processJob(message: JobMessage, env: Env, queueAttempts: number): Promise<void> {
  switch (message.type) {
    case "publish_post":
      await handlePublishPost(message, env, queueAttempts);
      break;
    case "process_queue":
      await handleProcessQueue(message, env);
      break;
    case "collect_metrics":
      await handleCollectMetrics(message, env);
      break;
    case "refresh_token":
      await handleTokenRefresh(message, env);
      break;
    default:
      console.error(`Unknown job type: ${(message as JobMessage).type}`);
  }
}

/**
 * Calculates the retry delay for a failed job message.
 * Uses exponential backoff based on the queue attempt count for publish jobs,
 * and a fixed 60-second delay for other job types.
 */
function getJobRetryDelay(message: JobMessage, queueAttempts: number): number {
  if (message.type === "publish_post") {
    return getRetryDelay(queueAttempts);
  }
  // Default retry delay for other job types
  return 60;
}

// =============================================================================
// Worker Export
// =============================================================================

export default {
  /**
   * Cron trigger handler - runs on the configured schedule.
   */
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    switch (event.cron) {
      case "* * * * *": // every minute
        ctx.waitUntil(
          Promise.all([
            processScheduledPosts(env),
            processPostQueue(env),
            processRecurringSchedules(env),
          ]),
        );
        break;

      case "0 * * * *": // every hour
        ctx.waitUntil(triggerMetricsCollection(env));
        break;

      case "0 0 * * *": // daily at midnight
        ctx.waitUntil(triggerTokenRefresh(env));
        break;

      default:
        console.log(`Unhandled cron schedule: ${event.cron}`);
    }
  },

  /**
   * Queue consumer handler - processes batches of job messages.
   */
  async queue(
    batch: JobMessageBatch,
    env: Env,
  ): Promise<void> {
    for (const msg of batch.messages) {
      try {
        await processJob(msg.body, env, msg.attempts);
        msg.ack();
      } catch (error) {
        console.error(`Job failed (type=${msg.body.type}, attempt=${msg.attempts}):`, error);
        // Retry with appropriate delay - Cloudflare Queues handles the retry
        msg.retry({ delaySeconds: getJobRetryDelay(msg.body, msg.attempts) });
      }
    }
  },
};
