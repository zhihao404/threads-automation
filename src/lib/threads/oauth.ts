// =============================================================================
// Threads OAuth 2.0 Flow Helpers
// =============================================================================

import type { LongLivedTokenResponse, ShortLivedTokenResponse } from "./types";

const THREADS_AUTHORIZE_URL = "https://threads.net/oauth/authorize";
const THREADS_TOKEN_URL = "https://graph.threads.net/oauth/access_token";
const THREADS_LONG_LIVED_TOKEN_URL = "https://graph.threads.net/access_token";

/** Default scopes required for full Threads API access */
const DEFAULT_SCOPES = [
  "threads_basic",
  "threads_content_publish",
  "threads_read_replies",
  "threads_manage_replies",
  "threads_manage_insights",
  "threads_delete",
] as const;

/**
 * Constructs the Threads OAuth authorization URL.
 * The user should be redirected to this URL to begin the OAuth flow.
 */
export function getAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
}): string {
  const scopes = params.scopes ?? [...DEFAULT_SCOPES];

  const url = new URL(THREADS_AUTHORIZE_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", scopes.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", params.state);

  return url.toString();
}

/**
 * Exchanges an authorization code for a short-lived access token.
 * This is step 2 of the OAuth flow, called after the user authorizes the app.
 *
 * The short-lived token is valid for 1 hour.
 */
export async function exchangeCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ accessToken: string; userId: string }> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri,
    code: params.code,
  });

  const response = await fetch(THREADS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to exchange code for token: ${response.status} ${errorText}`,
    );
  }

  const data = (await response.json()) as ShortLivedTokenResponse;

  return {
    accessToken: data.access_token,
    userId: String(data.user_id),
  };
}

/**
 * Exchanges a short-lived token for a long-lived token.
 * Long-lived tokens are valid for 60 days and can be refreshed.
 */
export async function getLongLivedToken(params: {
  clientSecret: string;
  shortLivedToken: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(THREADS_LONG_LIVED_TOKEN_URL);
  url.searchParams.set("grant_type", "th_exchange_token");
  url.searchParams.set("client_secret", params.clientSecret);
  url.searchParams.set("access_token", params.shortLivedToken);

  const response = await fetch(url.toString(), {
    method: "GET",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get long-lived token: ${response.status} ${errorText}`,
    );
  }

  const data = (await response.json()) as LongLivedTokenResponse;

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}
