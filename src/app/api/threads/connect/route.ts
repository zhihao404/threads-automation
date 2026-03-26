// =============================================================================
// GET /api/threads/connect - Initiates the Threads OAuth flow
// =============================================================================

import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/threads/oauth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "edge";

export async function GET(): Promise<NextResponse> {
  const { env } = getCloudflareContext();

  const clientId = env.THREADS_APP_ID;
  const appUrl = env.NEXT_PUBLIC_APP_URL;

  if (!clientId) {
    return NextResponse.json(
      { error: "THREADS_APP_ID is not configured" },
      { status: 500 },
    );
  }

  if (!appUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL is not configured" },
      { status: 500 },
    );
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
