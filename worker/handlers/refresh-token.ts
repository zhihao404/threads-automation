// =============================================================================
// Token Refresh Handler
// Refreshes long-lived Threads API tokens before they expire
// =============================================================================

import { eq } from "drizzle-orm";
import type { TokenRefreshMessage } from "../../src/lib/queue/types";
import type { Env } from "../types";
import { createWorkerDb } from "../db";
import { threadsAccounts } from "../../src/db/schema";
import { decryptTokenWithKey, encryptTokenWithKey } from "../crypto";

const THREADS_LONG_LIVED_TOKEN_URL = "https://graph.threads.net/access_token";

/**
 * Refreshes a long-lived Threads access token.
 *
 * 1. Gets the account and decrypts the current token
 * 2. Calls the Threads API to refresh the long-lived token
 * 3. Encrypts the new token
 * 4. Updates threadsAccounts with the new token and expiry
 */
export async function handleTokenRefresh(
  message: TokenRefreshMessage,
  env: Env,
): Promise<void> {
  const db = createWorkerDb(env.DB);
  const now = new Date();

  // 1. Get account, decrypt current token
  const accountRows = await db
    .select()
    .from(threadsAccounts)
    .where(eq(threadsAccounts.id, message.accountId))
    .limit(1);

  const account = accountRows[0];
  if (!account) {
    console.error(`Account ${message.accountId} not found for token refresh`);
    return;
  }

  let currentToken: string;
  try {
    currentToken = await decryptTokenWithKey(account.accessToken, env.ENCRYPTION_KEY);
  } catch (err) {
    console.error(`Failed to decrypt token for account ${message.accountId}:`, err);
    return;
  }

  // 2. Call the Threads API to refresh the long-lived token
  try {
    const url = new URL(THREADS_LONG_LIVED_TOKEN_URL);
    url.searchParams.set("grant_type", "th_refresh_token");
    url.searchParams.set("access_token", currentToken);

    const response = await fetch(url.toString(), { method: "GET" });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      token_type: string;
      expires_in: number;
    };

    // 3. Encrypt new token
    const encryptedToken = await encryptTokenWithKey(data.access_token, env.ENCRYPTION_KEY);

    // 4. Update threadsAccounts with new token and expiry
    const expiresAt = new Date(now.getTime() + data.expires_in * 1000);

    await db
      .update(threadsAccounts)
      .set({
        accessToken: encryptedToken,
        tokenExpiresAt: expiresAt,
        updatedAt: now,
      })
      .where(eq(threadsAccounts.id, message.accountId));

    console.log(
      `Token refreshed for account ${message.accountId}, expires at ${expiresAt.toISOString()}`,
    );
  } catch (err) {
    console.error(`Failed to refresh token for account ${message.accountId}:`, err);
    // Don't re-throw - token refresh failure is logged but shouldn't crash the worker
  }
}
