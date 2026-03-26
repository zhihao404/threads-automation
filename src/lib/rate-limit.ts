import { eq, and, sql } from "drizzle-orm";
import { rateLimits } from "@/db/schema";
import type { Database } from "@/db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Sliding window rate limiter backed by D1.
 *
 * Uses INSERT OR REPLACE with atomic count increment logic:
 * - If no row exists or the window has expired, insert a new row with count=1.
 * - If a row exists within the current window, atomically increment count.
 * - Returns whether the request is allowed, how many requests remain, and when the window resets.
 */
export async function checkRateLimit(
  db: Database,
  key: string,
  endpoint: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Use a single atomic upsert:
  // If a row exists for this key+endpoint with a windowStart within the current window,
  // increment the count. Otherwise, reset to count=1 with the current timestamp.
  await db.run(sql`
    INSERT INTO rate_limits (key, endpoint, window_start, count)
    VALUES (${key}, ${endpoint}, ${now}, 1)
    ON CONFLICT (key, endpoint) DO UPDATE SET
      count = CASE
        WHEN rate_limits.window_start > ${windowStart} THEN rate_limits.count + 1
        ELSE 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start > ${windowStart} THEN rate_limits.window_start
        ELSE ${now}
      END
  `);

  // Read the current state
  const rows = await db
    .select({
      count: rateLimits.count,
      windowStart: rateLimits.windowStart,
    })
    .from(rateLimits)
    .where(
      and(
        eq(rateLimits.key, key),
        eq(rateLimits.endpoint, endpoint),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    // Should not happen, but handle gracefully
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  const resetAt = row.windowStart + windowMs;
  const allowed = row.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - row.count);

  return { allowed, remaining, resetAt };
}
