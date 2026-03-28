// =============================================================================
// POST /api/webhooks/threads/deauthorize
// Called by Meta when a user removes the app from their account
// =============================================================================

import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { createDb } from "@/db";
import { threadsAccounts } from "@/db/schema";
import { verifySignedRequest } from "@/lib/threads/verify-signature";
import { logAuditEvent } from "@/lib/audit/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    console.log("[Threads Deauthorize] Received request");

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

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

    if (threadsUserId) {
      const threadsUserIdStr = String(threadsUserId);

      // Remove the user's Threads account data
      await db
        .delete(threadsAccounts)
        .where(eq(threadsAccounts.threadsUserId, threadsUserIdStr));

      // Audit log the disconnection
      await logAuditEvent(db, {
        actorType: "system",
        action: "account.disconnect",
        resourceType: "account",
        resourceId: threadsUserIdStr,
        metadata: { reason: "deauthorized_by_user" },
      });

      console.log(
        "[Threads Deauthorize] Removed account for user:",
        threadsUserIdStr,
      );
    }
  } catch (err) {
    console.error("[Threads Deauthorize] Error:", err);
  }

  return new Response("OK", { status: 200 });
}
