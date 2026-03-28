// =============================================================================
// GET /api/threads/connect - Initiates the Threads OAuth flow
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/threads/oauth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { session } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { guardPlanLimit } from "@/lib/plans/guard";

export const runtime = "edge";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { env } = await getCloudflareContext({ async: true });

  const clientId = env.THREADS_APP_ID;
  const appUrl = env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  if (!clientId) {
    return NextResponse.redirect(
      `${appUrl}/accounts?error=${encodeURIComponent("Threads APIの設定が完了していません。管理者にお問い合わせください。")}`,
    );
  }

  // Check authentication and account limit before starting OAuth
  const sessionToken = request.cookies.get("better-auth.session_token")?.value;
  if (sessionToken) {
    const db = createDb(env.DB);
    const sessions = await db
      .select({ userId: session.userId })
      .from(session)
      .where(
        and(
          eq(session.token, sessionToken),
          sql`${session.expiresAt} > ${Math.floor(Date.now() / 1000)}`,
        ),
      )
      .limit(1);

    const userId = sessions[0]?.userId;
    if (userId) {
      const limitResponse = await guardPlanLimit(db, userId, "account");
      if (limitResponse) {
        return NextResponse.redirect(
          `${appUrl}/accounts?error=${encodeURIComponent("プランの上限に達しました。アップグレードしてください。")}`,
        );
      }
    }
  }

  // Generate a cryptographically random state parameter for CSRF protection
  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = btoa(String.fromCharCode(...stateBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const redirectUri = `${appUrl}/api/threads/callback`;

  const authUrl = getAuthorizationUrl({
    clientId,
    redirectUri,
    state,
  });

  // Store state in a cookie for verification in the callback
  const response = NextResponse.redirect(authUrl);

  response.cookies.set("threads_oauth_state", state, {
    httpOnly: true,
    secure: appUrl.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return response;
}
