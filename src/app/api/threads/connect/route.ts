// =============================================================================
// GET /api/threads/connect - Initiates the Threads OAuth flow
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/threads/oauth";
import { createDb } from "@/db";
import { guardPlanLimit } from "@/lib/plans/guard";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { getCfEnv } from "@/lib/cloudflare";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cfEnv = await getCfEnv();

  const clientId = cfEnv?.THREADS_APP_ID ?? process.env.THREADS_APP_ID;
  const appUrl =
    cfEnv?.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    console.error("[Threads OAuth] NEXT_PUBLIC_APP_URL is not set");
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL must be configured" },
      { status: 500 },
    );
  }

  if (!clientId) {
    console.error("[Threads OAuth] THREADS_APP_ID is not set in .dev.vars or .env");
    return NextResponse.redirect(
      `${appUrl}/accounts?error=${encodeURIComponent("Threads APIの設定が完了していません。管理者にお問い合わせください。")}`,
    );
  }

  // Check authentication and account limit before starting OAuth
  if (cfEnv?.DB) {
    const userId = await getAuthenticatedUserId();
    if (userId) {
      const db = createDb(cfEnv.DB);
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
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300, // 5 minutes
  });

  return response;
}
