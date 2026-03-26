import { eq, and, sql } from "drizzle-orm";
import {
  subscriptions,
  usageRecords,
  threadsAccounts,
  postTemplates,
  posts,
} from "@/db/schema";
import { PLANS, type PlanType } from "@/lib/stripe/config";
import type { Database } from "@/db";
import { ulid } from "ulid";

// =============================================================================
// Types
// =============================================================================

export interface UsageStatus {
  type: string;
  current: number;
  limit: number; // -1 = unlimited
  remaining: number; // -1 = unlimited
  isLimited: boolean; // true if at or over limit
  percentage: number; // 0-100, for progress bars
}

// Mapping from usage type to the plan limit key
const USAGE_TYPE_TO_LIMIT_KEY: Record<string, keyof (typeof PLANS)["free"]["limits"]> = {
  post: "postsPerMonth",
  ai_generation: "aiGenerations",
  schedule: "scheduledPosts",
  template: "templates",
  account: "accounts",
};

// =============================================================================
// Billing period helpers
// =============================================================================

/**
 * Get the current billing period (1st of month to end of month).
 */
export function getCurrentPeriod(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0); // Last day of current month

  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// =============================================================================
// Core functions
// =============================================================================

/**
 * Get the user's current plan. Falls back to "free" if no active subscription.
 */
export async function getUserPlan(db: Database, userId: string): Promise<PlanType> {
  const rows = await db
    .select({ plan: subscriptions.plan })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
      ),
    )
    .limit(1);

  return (rows[0]?.plan as PlanType) ?? "free";
}

/**
 * Get current usage for a specific type in the current billing period.
 * For "template" and "account" types, returns total count instead of period usage.
 * For "schedule", returns currently active scheduled posts count.
 */
export async function getUsage(
  db: Database,
  userId: string,
  type: string,
): Promise<number> {
  // Template limit is total count, not monthly
  if (type === "template") {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(postTemplates)
      .where(eq(postTemplates.userId, userId));
    return result[0]?.count ?? 0;
  }

  // Account limit is total connected accounts
  if (type === "account") {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(threadsAccounts)
      .where(eq(threadsAccounts.userId, userId));
    return result[0]?.count ?? 0;
  }

  // Scheduled posts limit counts currently active scheduled posts
  if (type === "schedule") {
    // Get all user account IDs
    const userAccounts = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(eq(threadsAccounts.userId, userId));

    if (userAccounts.length === 0) return 0;

    const accountIds = userAccounts.map((a) => a.id);
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(
        and(
          sql`${posts.accountId} IN (${sql.join(
            accountIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
          eq(posts.status, "scheduled"),
        ),
      );
    return result[0]?.count ?? 0;
  }

  // Monthly usage types (post, ai_generation) - read from usage_records
  const period = getCurrentPeriod();
  const rows = await db
    .select({ count: usageRecords.count })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.userId, userId),
        eq(usageRecords.type, type as "post" | "ai_generation" | "schedule" | "template"),
        eq(usageRecords.periodStart, period.start),
      ),
    )
    .limit(1);

  return rows[0]?.count ?? 0;
}

/**
 * Check if the user can perform an action based on their plan limits.
 */
export async function checkLimit(
  db: Database,
  userId: string,
  type: string,
): Promise<{ allowed: boolean; usage: UsageStatus }> {
  const plan = await getUserPlan(db, userId);
  const planConfig = PLANS[plan];

  const limitKey = USAGE_TYPE_TO_LIMIT_KEY[type];
  if (!limitKey) {
    // Unknown type - allow by default
    return {
      allowed: true,
      usage: {
        type,
        current: 0,
        limit: -1,
        remaining: -1,
        isLimited: false,
        percentage: 0,
      },
    };
  }

  const limitValue = planConfig.limits[limitKey];

  // String limits (analytics, reports, replyManagement) are handled by guardFeatureAccess
  if (typeof limitValue === "string") {
    return {
      allowed: true,
      usage: {
        type,
        current: 0,
        limit: -1,
        remaining: -1,
        isLimited: false,
        percentage: 0,
      },
    };
  }

  const numericLimit = limitValue as number;
  const current = await getUsage(db, userId, type);

  // -1 = unlimited
  if (numericLimit === -1) {
    return {
      allowed: true,
      usage: {
        type,
        current,
        limit: -1,
        remaining: -1,
        isLimited: false,
        percentage: 0,
      },
    };
  }

  const remaining = Math.max(0, numericLimit - current);
  const isLimited = current >= numericLimit;
  const percentage = numericLimit > 0 ? Math.min(100, Math.round((current / numericLimit) * 100)) : 0;

  return {
    allowed: !isLimited,
    usage: {
      type,
      current,
      limit: numericLimit,
      remaining,
      isLimited,
      percentage,
    },
  };
}

/**
 * Increment usage counter for an action.
 * Only applies to monthly tracked types (post, ai_generation).
 */
export async function incrementUsage(
  db: Database,
  userId: string,
  type: string,
): Promise<void> {
  // Template, account, and schedule counts are derived from actual rows
  if (type === "template" || type === "account" || type === "schedule") {
    return;
  }

  const period = getCurrentPeriod();
  const validType = type as "post" | "ai_generation" | "schedule" | "template";

  // Try to update existing record first
  const existing = await db
    .select({ id: usageRecords.id, count: usageRecords.count })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.userId, userId),
        eq(usageRecords.type, validType),
        eq(usageRecords.periodStart, period.start),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(usageRecords)
      .set({ count: existing[0].count + 1 })
      .where(eq(usageRecords.id, existing[0].id));
  } else {
    await db.insert(usageRecords).values({
      id: ulid(),
      userId,
      type: validType,
      count: 1,
      periodStart: period.start,
      periodEnd: period.end,
      createdAt: new Date(),
    });
  }
}

/**
 * Get all usage stats for the user (for the billing/settings page).
 */
export async function getAllUsageStats(
  db: Database,
  userId: string,
): Promise<UsageStatus[]> {
  const plan = await getUserPlan(db, userId);
  const planConfig = PLANS[plan];

  const usageTypes = [
    { type: "post", limitKey: "postsPerMonth" as const },
    { type: "ai_generation", limitKey: "aiGenerations" as const },
    { type: "schedule", limitKey: "scheduledPosts" as const },
    { type: "template", limitKey: "templates" as const },
    { type: "account", limitKey: "accounts" as const },
  ];

  const results: UsageStatus[] = [];

  for (const { type, limitKey } of usageTypes) {
    const numericLimit = planConfig.limits[limitKey] as number;
    const current = await getUsage(db, userId, type);

    if (numericLimit === -1) {
      results.push({
        type,
        current,
        limit: -1,
        remaining: -1,
        isLimited: false,
        percentage: 0,
      });
    } else {
      const remaining = Math.max(0, numericLimit - current);
      const isLimited = current >= numericLimit;
      const percentage = numericLimit > 0 ? Math.min(100, Math.round((current / numericLimit) * 100)) : 0;
      results.push({
        type,
        current,
        limit: numericLimit,
        remaining,
        isLimited,
        percentage,
      });
    }
  }

  return results;
}
