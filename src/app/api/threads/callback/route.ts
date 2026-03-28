// =============================================================================
// GET /api/threads/callback - Handles the Threads OAuth callback
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getLongLivedToken } from "@/lib/threads/oauth";
import { ThreadsClient } from "@/lib/threads/client";
import { encryptToken } from "@/lib/threads/encryption";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { getCfEnv } from "@/lib/cloudflare";
import { ulid } from "ulid";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cfEnv = await getCfEnv();
  const { searchParams } = request.nextUrl;

  const appUrl =
    cfEnv?.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    console.error("[Threads Callback] NEXT_PUBLIC_APP_URL is not set");
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL must be configured" },
      { status: 500 },
    );
  }

  // ---------------------------------------------------------------------------
  // 1. Verify state parameter (CSRF protection)
  // ---------------------------------------------------------------------------
  const state = searchParams.get("state");
  const storedState = request.cookies.get("threads_oauth_state")?.value;

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      `${appUrl}/accounts?error=${encodeURIComponent("Invalid state parameter. Please try connecting again.")}`,
    );
  }

  // Check for error from Threads (user denied access, etc.)
  const error = searchParams.get("error");
  if (error) {
    const errorDescription =
      searchParams.get("error_description") ?? "Authorization was denied";
    return NextResponse.redirect(
      `${appUrl}/accounts?error=${encodeURIComponent(errorDescription)}`,
    );
  }

  // Get the authorization code
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      `${appUrl}/accounts?error=${encodeURIComponent("No authorization code received.")}`,
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Validate required environment variables
  // ---------------------------------------------------------------------------
  const clientId = cfEnv?.THREADS_APP_ID ?? process.env.THREADS_APP_ID;
  const clientSecret = cfEnv?.THREADS_APP_SECRET ?? process.env.THREADS_APP_SECRET;
  const encryptionKey = cfEnv?.ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY;
  const d1 = cfEnv?.DB;

  if (!clientId || !clientSecret || !encryptionKey || !d1) {
    console.error("[Threads Callback] Missing required config:", {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasEncryptionKey: !!encryptionKey,
      hasDb: !!d1,
    });
    return NextResponse.redirect(
      `${appUrl}/accounts?error=${encodeURIComponent("Server configuration error. Please contact support.")}`,
    );
  }

  const redirectUri = `${appUrl}/api/threads/callback`;

  try {
    // -------------------------------------------------------------------------
    // 3. Validate session via centralized auth helper
    // -------------------------------------------------------------------------
    const appUserId = await getAuthenticatedUserId();

    if (!appUserId) {
      return NextResponse.redirect(
        `${appUrl}/accounts?error=${encodeURIComponent("セッションが無効です。再ログインしてください。")}`,
      );
    }

    // -------------------------------------------------------------------------
    // 4. Exchange code for short-lived token
    // -------------------------------------------------------------------------
    const { accessToken: shortLivedToken, userId: threadsUserId } =
      await exchangeCodeForToken({
        clientId,
        clientSecret,
        redirectUri,
        code,
      });

    // -------------------------------------------------------------------------
    // 5. Exchange for long-lived token
    // -------------------------------------------------------------------------
    const { accessToken: longLivedToken, expiresIn } =
      await getLongLivedToken({
        clientSecret,
        shortLivedToken,
      });

    // -------------------------------------------------------------------------
    // 6. Get user profile from Threads API
    // -------------------------------------------------------------------------
    const client = new ThreadsClient(longLivedToken);
    const profile = await client.getProfile();
    const displayName = profile.name ?? null;
    const profilePicUrl = profile.threads_profile_picture_url ?? null;
    const biography = profile.threads_biography ?? null;
    const isVerified = profile.is_verified ? 1 : 0;

    // -------------------------------------------------------------------------
    // 7. Encrypt and save token to D1 database
    // -------------------------------------------------------------------------
    const encryptedToken = await encryptToken(longLivedToken, encryptionKey);
    const nowTs = Math.floor(Date.now() / 1000);
    const tokenExpiresAt = nowTs + expiresIn;

    // Check if this Threads account is already connected
    const existing = await d1
      .prepare(
        "SELECT id, user_id FROM threads_accounts WHERE threads_user_id = ?",
      )
      .bind(threadsUserId)
      .first<{ id: string; user_id: string }>();

    if (existing) {
      if (existing.user_id !== appUserId) {
        return NextResponse.redirect(
          `${appUrl}/accounts?error=${encodeURIComponent("このThreadsアカウントは別のユーザーに接続されています。")}`,
        );
      }

      await d1
        .prepare(
          `UPDATE threads_accounts
           SET access_token = ?,
               token_expires_at = ?,
               username = ?,
               display_name = ?,
               profile_picture_url = ?,
               biography = ?,
               is_verified = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          encryptedToken,
          tokenExpiresAt,
          profile.username,
          displayName,
          profilePicUrl,
          biography,
          isVerified,
          nowTs,
          existing.id,
        )
        .run();
    } else {
      const accountId = ulid();

      await d1
        .prepare(
          `INSERT INTO threads_accounts
           (id, user_id, threads_user_id, username, display_name, access_token, token_expires_at, profile_picture_url, biography, is_verified, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          accountId,
          appUserId,
          threadsUserId,
          profile.username,
          displayName,
          encryptedToken,
          tokenExpiresAt,
          profilePicUrl,
          biography,
          isVerified,
          nowTs,
          nowTs,
        )
        .run();
    }

    // -------------------------------------------------------------------------
    // 8. Clear the state cookie and redirect to accounts page
    // -------------------------------------------------------------------------
    const successResponse = NextResponse.redirect(
      `${appUrl}/accounts?success=${encodeURIComponent(`@${profile.username} を接続しました`)}`,
    );

    successResponse.cookies.set("threads_oauth_state", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return successResponse;
  } catch (err) {
    console.error("[Threads Callback] Error:", err);

    const errorResponse = NextResponse.redirect(
      `${appUrl}/accounts?error=${encodeURIComponent("接続に失敗しました")}`,
    );

    errorResponse.cookies.set("threads_oauth_state", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return errorResponse;
  }
}
