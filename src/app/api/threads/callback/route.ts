// =============================================================================
// GET /api/threads/callback - Handles the Threads OAuth callback
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { exchangeCodeForToken, getLongLivedToken } from "@/lib/threads/oauth";
import { ThreadsClient } from "@/lib/threads/client";
import { encryptToken } from "@/lib/threads/encryption";
import { ulid } from "ulid";

export const runtime = "edge";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { env } = await getCloudflareContext({ async: true });
  const { searchParams } = request.nextUrl;

  const appUrl = env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL is not configured" },
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
  const clientId = env.THREADS_APP_ID;
  const clientSecret = env.THREADS_APP_SECRET;
  const encryptionKey = env.ENCRYPTION_KEY;

  if (!clientId || !clientSecret || !encryptionKey) {
    console.error("Missing required environment variables for Threads OAuth");
    return NextResponse.redirect(
      `${appUrl}/accounts?error=${encodeURIComponent("Server configuration error. Please contact support.")}`,
    );
  }

  const redirectUri = `${appUrl}/api/threads/callback`;

  try {
    // -------------------------------------------------------------------------
    // 3. Validate session (authenticate user BEFORE exchanging tokens)
    // -------------------------------------------------------------------------
    const db = env.DB;
    if (!db) {
      throw new Error("D1 database binding (DB) is not configured");
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("better-auth.session_token")?.value;

    if (!sessionToken) {
      return NextResponse.redirect(
        `${appUrl}/accounts?error=${encodeURIComponent("You must be logged in to connect a Threads account.")}`,
      );
    }

    const sessionRow = await db
      .prepare(
        "SELECT user_id FROM session WHERE token = ? AND expires_at > ?",
      )
      .bind(sessionToken, Math.floor(Date.now() / 1000))
      .first<{ user_id: string }>();

    if (!sessionRow) {
      return NextResponse.redirect(
        `${appUrl}/accounts?error=${encodeURIComponent("Your session has expired. Please log in again.")}`,
      );
    }

    const appUserId = sessionRow.user_id;

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

    // -------------------------------------------------------------------------
    // 7. Encrypt and save token to D1 database
    // -------------------------------------------------------------------------
    const encryptedToken = await encryptToken(longLivedToken, encryptionKey);
    const now = Math.floor(Date.now() / 1000);
    const tokenExpiresAt = now + expiresIn;

    // Check if this Threads account is already connected
    const existing = await db
      .prepare(
        "SELECT id, user_id FROM threads_accounts WHERE threads_user_id = ?",
      )
      .bind(threadsUserId)
      .first<{ id: string; user_id: string }>();

    if (existing) {
      // Prevent User B from overwriting User A's token
      if (existing.user_id !== appUserId) {
        return NextResponse.redirect(
          `${appUrl}/accounts?error=${encodeURIComponent("This Threads account is already connected to another user.")}`,
        );
      }

      // Update existing account with new token and profile data
      await db
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
          profile.name,
          profile.threads_profile_picture_url,
          profile.threads_biography,
          profile.is_verified ? 1 : 0,
          now,
          existing.id,
        )
        .run();
    } else {
      const accountId = ulid();

      await db
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
          profile.name,
          encryptedToken,
          tokenExpiresAt,
          profile.threads_profile_picture_url,
          profile.threads_biography,
          profile.is_verified ? 1 : 0,
          now,
          now,
        )
        .run();
    }

    // -------------------------------------------------------------------------
    // 7. Clear the state cookie and redirect to accounts page
    // -------------------------------------------------------------------------
    const successResponse = NextResponse.redirect(
      `${appUrl}/accounts?success=${encodeURIComponent(`Successfully connected @${profile.username}`)}`,
    );

    successResponse.cookies.set("threads_oauth_state", "", {
      httpOnly: true,
      secure: appUrl.startsWith("https"),
      sameSite: "lax",
      path: "/",
      maxAge: 0, // Delete the cookie
    });

    return successResponse;
  } catch (err) {
    console.error("Threads OAuth callback error:", err);

    // Clear state cookie on error too
    const errorResponse = NextResponse.redirect(
      `${appUrl}/accounts?error=${encodeURIComponent("接続に失敗しました")}`,
    );

    errorResponse.cookies.set("threads_oauth_state", "", {
      httpOnly: true,
      secure: appUrl.startsWith("https"),
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return errorResponse;
  }
}
