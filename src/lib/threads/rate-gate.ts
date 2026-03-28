// =============================================================================
// Rate Gate Service
// Centralized rate limiting for Threads API profile-level quotas.
//
// Enforces three independent limits per Threads account:
//   1. Posts:     250 / 24 h sliding window
//   2. Replies: 1,000 / 24 h sliding window
//   3. API calls: 4,800 x max(impressions, 10) / 24 h  (Graph API formula)
//
// Every publish / reply / API call MUST go through this gate so that the SaaS
// never exceeds the upstream Threads limits on behalf of any user profile.
// =============================================================================

import { eq, and, gte, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { profileApiUsage, accountMetrics } from "@/db/schema";
import type { Database } from "@/db";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum posts per profile in a 24 h sliding window. */
const MAX_POSTS_PER_24H = 250;

/** Maximum replies per profile in a 24 h sliding window. */
const MAX_REPLIES_PER_24H = 1_000;

/** Graph API base multiplier: limit = BASE_MULTIPLIER * max(impressions, MIN_IMPRESSIONS). */
const API_CALL_BASE_MULTIPLIER = 4_800;

/** Minimum impression count used in the API call formula. */
const MIN_IMPRESSIONS = 10;

/** 24 hours expressed in seconds. */
const WINDOW_SECONDS = 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionType = "post" | "reply" | "api_call";

export interface QuotaStatus {
  /** Whether the action is currently allowed. */
  allowed: boolean;
  /** Number of actions used in the current 24 h window. */
  used: number;
  /** Maximum actions allowed in the window. */
  limit: number;
  /** Remaining actions before the limit is reached. */
  remaining: number;
  /** Unix-second timestamp when the oldest tracked action exits the window. */
  windowResetsAt: number | null;
}

export interface RemainingQuota {
  posts: QuotaStatus;
  replies: QuotaStatus;
  apiCalls: QuotaStatus;
}

export interface QuotaExhaustionPrediction {
  /** True if the scheduled count would exceed the limit. */
  willExceed: boolean;
  /** Actions remaining after accounting for scheduled posts. */
  remainingAfterScheduled: number;
  /** Current limit for this action type. */
  limit: number;
  /** Current usage count. */
  currentUsage: number;
  /** How many additional actions were requested. */
  scheduledCount: number;
}

// ---------------------------------------------------------------------------
// Core helpers (private)
// ---------------------------------------------------------------------------

/**
 * Returns the Unix-second timestamp 24 hours ago from `now`.
 */
function windowStart(nowSeconds: number): number {
  return nowSeconds - WINDOW_SECONDS;
}

/**
 * Counts how many rows of a given action type exist for the account
 * within the 24 h sliding window.
 */
async function countInWindow(
  db: Database,
  accountId: string,
  actionType: ActionType,
  nowSeconds: number,
): Promise<number> {
  const cutoff = windowStart(nowSeconds);

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(profileApiUsage)
    .where(
      and(
        eq(profileApiUsage.threadsAccountId, accountId),
        eq(profileApiUsage.actionType, actionType),
        gte(profileApiUsage.timestamp, cutoff),
      ),
    );

  return rows[0]?.count ?? 0;
}

/**
 * Returns the timestamp of the oldest action in the current window.
 * This tells us when the window will "lose" its oldest item.
 */
async function oldestTimestampInWindow(
  db: Database,
  accountId: string,
  actionType: ActionType,
  nowSeconds: number,
): Promise<number | null> {
  const cutoff = windowStart(nowSeconds);

  const rows = await db
    .select({ oldest: sql<number | null>`min(${profileApiUsage.timestamp})` })
    .from(profileApiUsage)
    .where(
      and(
        eq(profileApiUsage.threadsAccountId, accountId),
        eq(profileApiUsage.actionType, actionType),
        gte(profileApiUsage.timestamp, cutoff),
      ),
    );

  return rows[0]?.oldest ?? null;
}

/**
 * Fetches the most recent impressions (views) for the account from
 * the `account_metrics` table. Falls back to MIN_IMPRESSIONS.
 */
async function getImpressions(
  db: Database,
  accountId: string,
): Promise<number> {
  const rows = await db
    .select({ views: accountMetrics.views })
    .from(accountMetrics)
    .where(eq(accountMetrics.accountId, accountId))
    .orderBy(sql`${accountMetrics.date} DESC`)
    .limit(1);

  const views = rows[0]?.views ?? 0;
  return Math.max(views, MIN_IMPRESSIONS);
}

/**
 * Computes the Graph API call limit for a given impression count.
 */
function computeApiCallLimit(impressions: number): number {
  return API_CALL_BASE_MULTIPLIER * impressions;
}

// ---------------------------------------------------------------------------
// Public API: check functions
// ---------------------------------------------------------------------------

/**
 * Checks whether the account is allowed to publish a new post.
 */
export async function canPublish(
  db: Database,
  accountId: string,
): Promise<QuotaStatus> {
  const now = Math.floor(Date.now() / 1000);
  const used = await countInWindow(db, accountId, "post", now);
  const limit = MAX_POSTS_PER_24H;
  const remaining = Math.max(0, limit - used);
  const oldest = await oldestTimestampInWindow(db, accountId, "post", now);

  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
    windowResetsAt: oldest !== null ? oldest + WINDOW_SECONDS : null,
  };
}

/**
 * Checks whether the account is allowed to send a reply.
 */
export async function canReply(
  db: Database,
  accountId: string,
): Promise<QuotaStatus> {
  const now = Math.floor(Date.now() / 1000);
  const used = await countInWindow(db, accountId, "reply", now);
  const limit = MAX_REPLIES_PER_24H;
  const remaining = Math.max(0, limit - used);
  const oldest = await oldestTimestampInWindow(db, accountId, "reply", now);

  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
    windowResetsAt: oldest !== null ? oldest + WINDOW_SECONDS : null,
  };
}

/**
 * Checks whether the account is allowed to make another Graph API call.
 */
export async function canCallApi(
  db: Database,
  accountId: string,
): Promise<QuotaStatus> {
  const now = Math.floor(Date.now() / 1000);
  const impressions = await getImpressions(db, accountId);
  const limit = computeApiCallLimit(impressions);
  const used = await countInWindow(db, accountId, "api_call", now);
  const remaining = Math.max(0, limit - used);
  const oldest = await oldestTimestampInWindow(db, accountId, "api_call", now);

  return {
    allowed: used < limit,
    used,
    limit,
    remaining,
    windowResetsAt: oldest !== null ? oldest + WINDOW_SECONDS : null,
  };
}

// ---------------------------------------------------------------------------
// Public API: record functions
// ---------------------------------------------------------------------------

/**
 * Records a post action for the account in the usage table.
 */
export async function recordPublish(
  db: Database,
  accountId: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.insert(profileApiUsage).values({
    id: ulid(),
    threadsAccountId: accountId,
    actionType: "post",
    timestamp: now,
    createdAt: now,
  });
}

/**
 * Records a reply action for the account in the usage table.
 */
export async function recordReply(
  db: Database,
  accountId: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.insert(profileApiUsage).values({
    id: ulid(),
    threadsAccountId: accountId,
    actionType: "reply",
    timestamp: now,
    createdAt: now,
  });
}

/**
 * Records a Graph API call for the account in the usage table.
 */
export async function recordApiCall(
  db: Database,
  accountId: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.insert(profileApiUsage).values({
    id: ulid(),
    threadsAccountId: accountId,
    actionType: "api_call",
    timestamp: now,
    createdAt: now,
  });
}

// ---------------------------------------------------------------------------
// Public API: quota overview & prediction
// ---------------------------------------------------------------------------

/**
 * Returns the full remaining quota for an account across all three dimensions.
 * Useful for UI display.
 */
export async function getRemainingQuota(
  db: Database,
  accountId: string,
): Promise<RemainingQuota> {
  const [posts, replies, apiCalls] = await Promise.all([
    canPublish(db, accountId),
    canReply(db, accountId),
    canCallApi(db, accountId),
  ]);

  return { posts, replies, apiCalls };
}

/**
 * Predicts whether scheduling `scheduledCount` additional actions of the
 * given type will exceed the quota within the current 24 h window.
 *
 * This is designed to be called at schedule-creation time to warn users
 * before they queue up more posts than the profile can handle.
 */
export async function predictQuotaExhaustion(
  db: Database,
  accountId: string,
  scheduledCount: number,
  actionType: ActionType = "post",
): Promise<QuotaExhaustionPrediction> {
  const now = Math.floor(Date.now() / 1000);
  const currentUsage = await countInWindow(db, accountId, actionType, now);

  let limit: number;
  if (actionType === "post") {
    limit = MAX_POSTS_PER_24H;
  } else if (actionType === "reply") {
    limit = MAX_REPLIES_PER_24H;
  } else {
    const impressions = await getImpressions(db, accountId);
    limit = computeApiCallLimit(impressions);
  }

  const remainingAfterScheduled = Math.max(0, limit - currentUsage - scheduledCount);
  const willExceed = currentUsage + scheduledCount > limit;

  return {
    willExceed,
    remainingAfterScheduled,
    limit,
    currentUsage,
    scheduledCount,
  };
}

// ---------------------------------------------------------------------------
// Maintenance: clean up expired records
// ---------------------------------------------------------------------------

/**
 * Deletes usage records older than the 24 h window.
 * Should be called periodically (e.g., via a cron worker) to keep the
 * table size bounded.
 */
export async function pruneExpiredUsage(db: Database): Promise<number> {
  const cutoff = Math.floor(Date.now() / 1000) - WINDOW_SECONDS;

  const result = await db
    .delete(profileApiUsage)
    .where(sql`${profileApiUsage.timestamp} < ${cutoff}`);

  return result.meta.changes;
}
