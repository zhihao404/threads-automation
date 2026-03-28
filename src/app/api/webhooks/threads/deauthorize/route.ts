// =============================================================================
// POST /api/webhooks/threads/deauthorize
// Called by Meta when a user removes the app from their account
// =============================================================================

import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { verifySignedRequest } from "@/lib/threads/verify-signature";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    console.log("[Threads Deauthorize] Received:", body);

    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;

    // Parse the signed_request from Meta
    const params = new URLSearchParams(body);
    const signedRequest = params.get("signed_request");

    if (!signedRequest) {
      return new Response("Missing signed_request", { status: 400 });
    }

    // Verify HMAC signature before processing
    const decoded = await verifySignedRequest<{ user_id?: string }>(
      signedRequest,
      env.THREADS_APP_SECRET,
    );

    if (!decoded) {
      console.warn("[Threads Deauthorize] Signature verification failed");
      return new Response("Invalid signature", { status: 401 });
    }

    const threadsUserId = decoded.user_id;

    if (threadsUserId && db) {
      // Remove the user's Threads account data
      await db
        .prepare("DELETE FROM threads_accounts WHERE threads_user_id = ?")
        .bind(String(threadsUserId))
        .run();
      console.log("[Threads Deauthorize] Removed account for user:", threadsUserId);
    }
  } catch (err) {
    console.error("[Threads Deauthorize] Error:", err);
  }

  return new Response("OK", { status: 200 });
}
