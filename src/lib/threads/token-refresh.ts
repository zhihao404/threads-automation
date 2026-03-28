// =============================================================================
// Token Lifecycle Management
// Handles refresh, health checks, and expiry warnings for Threads OAuth tokens
// =============================================================================

import { eq, lte, and, gt } from "drizzle-orm";
import { ulid } from "ulid";
import type { Database } from "@/db";
import { threadsAccounts, notifications, type ThreadsAccount } from "@/db/schema";
import { decryptToken, encryptToken } from "@/lib/threads/encryption";
import type { LongLivedTokenResponse } from "@/lib/threads/types";

const THREADS_LONG_LIVED_TOKEN_URL = "https://graph.threads.net/access_token";

/** Number of days before expiry to begin refresh attempts (production) */
const REFRESH_WINDOW_DAYS = 14;

/** Maximum consecutive failures before we stop retrying automatically */
const MAX_AUTO_RETRY_FAILURES = 3;

// =============================================================================
// Types
// =============================================================================

export type TokenHealthStatus =
  | "valid"
  | "expiring_soon"
  | "expired"
  | "refresh_failed";

export interface TokenHealth {
  status: TokenHealthStatus;
  daysUntilExpiry: number;
  lastRefreshAt: Date | null;
  refreshFailureCount: number;
  refreshError: string | null;
}

export interface RefreshResult {
  accountId: string;
  username: string;
  success: boolean;
  error?: string;
  newExpiresAt?: Date;
}

export interface BatchRefreshResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: RefreshResult[];
}

// =============================================================================
// refreshTokenForAccount
// Refreshes a single account's long-lived token via the Threads API
// =============================================================================

export async function refreshTokenForAccount(
  db: Database,
  account: ThreadsAccount,
): Promise<RefreshResult> {
  const now = new Date();

  // 1. Decrypt the current token
  let currentToken: string;
  try {
    currentToken = await decryptToken(account.accessToken);
  } catch (err) {
    const error = `Failed to decrypt token: ${err instanceof Error ? err.message : String(err)}`;
    await markRefreshFailure(db, account.id, error, now);
    return { accountId: account.id, username: account.username, success: false, error };
  }

  // 2. Call the Threads API to refresh the long-lived token
  try {
    const url = new URL(THREADS_LONG_LIVED_TOKEN_URL);
    url.searchParams.set("grant_type", "th_refresh_token");
    url.searchParams.set("access_token", currentToken);

    const response = await fetch(url.toString(), { method: "GET" });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Threads API ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as LongLivedTokenResponse;

    // 3. Encrypt the new token
    const encryptedToken = await encryptToken(data.access_token);

    // 4. Update DB with new token, expiry, and reset failure tracking
    const newExpiresAt = new Date(now.getTime() + data.expires_in * 1000);

    await db
      .update(threadsAccounts)
      .set({
        accessToken: encryptedToken,
        tokenExpiresAt: newExpiresAt,
        lastRefreshAt: now,
        refreshFailureCount: 0,
        refreshError: null,
        updatedAt: now,
      })
      .where(eq(threadsAccounts.id, account.id));

    console.log(
      `[Token Refresh] Success: account=${account.id} (@${account.username}), new expiry=${newExpiresAt.toISOString()}`,
    );

    return {
      accountId: account.id,
      username: account.username,
      success: true,
      newExpiresAt,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await markRefreshFailure(db, account.id, error, now);

    console.error(
      `[Token Refresh] Failed: account=${account.id} (@${account.username}), error=${error}`,
    );

    return { accountId: account.id, username: account.username, success: false, error };
  }
}

// =============================================================================
// refreshExpiringTokens
// Batch job: finds all accounts expiring within REFRESH_WINDOW_DAYS and refreshes
// =============================================================================

export async function refreshExpiringTokens(
  db: Database,
): Promise<BatchRefreshResult> {
  const now = new Date();
  const refreshThreshold = new Date(
    now.getTime() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  // Find accounts whose tokens expire within the refresh window and are not
  // already expired (expired tokens cannot be refreshed via the API).
  const expiringAccounts = await db
    .select()
    .from(threadsAccounts)
    .where(
      and(
        lte(threadsAccounts.tokenExpiresAt, refreshThreshold),
        gt(threadsAccounts.tokenExpiresAt, now),
      ),
    );

  const result: BatchRefreshResult = {
    total: expiringAccounts.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    results: [],
  };

  console.log(
    `[Token Refresh Batch] Found ${expiringAccounts.length} accounts with tokens expiring before ${refreshThreshold.toISOString()}`,
  );

  for (const account of expiringAccounts) {
    // Skip accounts that have exceeded the auto-retry limit; they need manual re-auth
    if (account.refreshFailureCount >= MAX_AUTO_RETRY_FAILURES) {
      console.log(
        `[Token Refresh Batch] Skipping account=${account.id} (@${account.username}): exceeded max retry count (${account.refreshFailureCount})`,
      );
      result.skipped++;
      result.results.push({
        accountId: account.id,
        username: account.username,
        success: false,
        error: `Skipped: exceeded max auto-retry limit (${MAX_AUTO_RETRY_FAILURES} consecutive failures)`,
      });
      continue;
    }

    const refreshResult = await refreshTokenForAccount(db, account);
    result.results.push(refreshResult);

    if (refreshResult.success) {
      result.succeeded++;
    } else {
      result.failed++;

      // Create a notification for the user on failure
      await createRefreshFailureNotification(
        db,
        account.id,
        account.username,
        refreshResult.error ?? "Unknown error",
        account.refreshFailureCount + 1,
      );
    }
  }

  console.log(
    `[Token Refresh Batch] Complete: total=${result.total}, succeeded=${result.succeeded}, failed=${result.failed}, skipped=${result.skipped}`,
  );

  return result;
}

// =============================================================================
// checkTokenHealth
// Returns detailed health status for a specific account's token
// =============================================================================

export async function checkTokenHealth(
  db: Database,
  accountId: string,
): Promise<TokenHealth | null> {
  const accountRows = await db
    .select()
    .from(threadsAccounts)
    .where(eq(threadsAccounts.id, accountId))
    .limit(1);

  const account = accountRows[0];
  if (!account) {
    return null;
  }

  const now = new Date();
  const expiresAt = account.tokenExpiresAt;
  const msUntilExpiry = expiresAt.getTime() - now.getTime();
  const daysUntilExpiry = Math.floor(msUntilExpiry / (24 * 60 * 60 * 1000));

  let status: TokenHealthStatus;

  if (account.refreshFailureCount >= MAX_AUTO_RETRY_FAILURES) {
    status = "refresh_failed";
  } else if (msUntilExpiry <= 0) {
    status = "expired";
  } else if (daysUntilExpiry <= REFRESH_WINDOW_DAYS) {
    status = "expiring_soon";
  } else {
    status = "valid";
  }

  return {
    status,
    daysUntilExpiry: Math.max(daysUntilExpiry, 0),
    lastRefreshAt: account.lastRefreshAt,
    refreshFailureCount: account.refreshFailureCount,
    refreshError: account.refreshError,
  };
}

// =============================================================================
// getTokenExpiryWarning
// Returns a user-facing warning message if token is expiring within 14 days
// =============================================================================

export function getTokenExpiryWarning(
  account: ThreadsAccount,
): string | null {
  const now = new Date();
  const expiresAt = account.tokenExpiresAt;
  const msUntilExpiry = expiresAt.getTime() - now.getTime();
  const daysUntilExpiry = Math.floor(msUntilExpiry / (24 * 60 * 60 * 1000));

  if (msUntilExpiry <= 0) {
    return `@${account.username} のアクセストークンが期限切れです。設定画面からThreadsアカウントを再接続してください。`;
  }

  if (daysUntilExpiry <= REFRESH_WINDOW_DAYS) {
    if (account.refreshFailureCount >= MAX_AUTO_RETRY_FAILURES) {
      return `@${account.username} のトークン自動更新に失敗しました（${account.refreshFailureCount}回連続）。設定画面からThreadsアカウントを再接続してください。`;
    }
    return `@${account.username} のアクセストークンが${daysUntilExpiry}日後に期限切れになります。自動更新が予定されています。`;
  }

  return null;
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Records a refresh failure in the database by incrementing the failure count
 * and storing the error message.
 */
async function markRefreshFailure(
  db: Database,
  accountId: string,
  error: string,
  now: Date,
): Promise<void> {
  // Fetch current failure count to increment
  const rows = await db
    .select({ refreshFailureCount: threadsAccounts.refreshFailureCount })
    .from(threadsAccounts)
    .where(eq(threadsAccounts.id, accountId))
    .limit(1);

  const currentCount = rows[0]?.refreshFailureCount ?? 0;

  await db
    .update(threadsAccounts)
    .set({
      refreshFailureCount: currentCount + 1,
      refreshError: error,
      updatedAt: now,
    })
    .where(eq(threadsAccounts.id, accountId));
}

/**
 * Creates a notification alerting the user that token refresh has failed
 * and they need to re-authorize their Threads account.
 */
async function createRefreshFailureNotification(
  db: Database,
  accountId: string,
  username: string,
  error: string,
  failureCount: number,
): Promise<void> {
  try {
    const isMaxRetries = failureCount >= MAX_AUTO_RETRY_FAILURES;
    const title = isMaxRetries
      ? "Threadsアカウントの再接続が必要です"
      : "トークン更新に失敗しました";

    const body = isMaxRetries
      ? `@${username} のアクセストークンの自動更新に${failureCount}回連続で失敗しました。設定画面からThreadsアカウントを再接続してください。`
      : `@${username} のアクセストークンの更新に失敗しました（${failureCount}回目）。次回のバッチ実行時に再試行します。エラー: ${error}`;

    await db.insert(notifications).values({
      id: ulid(),
      accountId,
      type: "token_refresh_failed",
      title,
      body,
      metadata: JSON.stringify({
        error,
        failureCount,
        requiresReauth: isMaxRetries,
      }),
      isRead: false,
      createdAt: new Date(),
    });
  } catch (notifErr) {
    console.error(
      `[Token Refresh] Failed to create notification for account=${accountId}:`,
      notifErr,
    );
  }
}
