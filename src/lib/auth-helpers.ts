import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import type { Database } from "@/db";
import { session, threadsAccounts } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { cookies } from "next/headers";

/**
 * Authenticate the current request by reading the session cookie,
 * looking it up in the DB, and returning the userId if the session
 * is still valid.  Returns null when unauthenticated.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get("better-auth.session_token")?.value;
  if (!rawToken) return null;

  // Better Auth stores "{token}.{signature}" in the cookie — strip the signature
  const sessionToken = rawToken.split(".")[0]!;

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  const sessions = await db
    .select({ userId: session.userId })
    .from(session)
    .where(
      and(
        eq(session.token, sessionToken),
        sql`${session.expiresAt} > ${Math.floor(Date.now() / 1000)}`
      )
    )
    .limit(1);

  return sessions[0]?.userId ?? null;
}

/**
 * Result of a successful authentication + DB context setup.
 */
export interface AuthContext {
  userId: string;
  db: Database;
  env: Awaited<ReturnType<typeof getCloudflareContext>>["env"];
}

/**
 * Authenticates the user and creates a DB context in one call.
 * Returns either an AuthContext on success, or a NextResponse (401) on failure.
 *
 * Usage:
 *   const authResult = await getAuthContext();
 *   if (authResult instanceof NextResponse) return authResult;
 *   const { userId, db, env } = authResult;
 */
export async function getAuthContext(): Promise<AuthContext | NextResponse> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "認証が必要です" },
      { status: 401 },
    );
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  return { userId, db, env };
}

/**
 * Result of verifying that an account belongs to the authenticated user.
 */
export interface AuthAccountContext extends AuthContext {
  accountId: string;
}

/**
 * Authenticates the user, creates a DB context, and verifies account ownership
 * in one call. Returns either an AuthAccountContext on success, or a NextResponse
 * (401 or 404) on failure.
 *
 * Usage:
 *   const result = await getAuthenticatedAccountContext(accountId);
 *   if (result instanceof NextResponse) return result;
 *   const { userId, db, env, accountId } = result;
 */
export async function getAuthenticatedAccountContext(
  accountId: string,
): Promise<AuthAccountContext | NextResponse> {
  const authResult = await getAuthContext();
  if (authResult instanceof NextResponse) return authResult;

  const { userId, db, env } = authResult;

  const accountRows = await db
    .select({ id: threadsAccounts.id })
    .from(threadsAccounts)
    .where(
      and(
        eq(threadsAccounts.id, accountId),
        eq(threadsAccounts.userId, userId),
      ),
    )
    .limit(1);

  if (!accountRows[0]) {
    return NextResponse.json(
      { error: "アカウントが見つかりません" },
      { status: 404 },
    );
  }

  return { userId, db, env, accountId };
}
