// =============================================================================
// POST /api/webhooks/threads/data-deletion
// Called by Meta when a user requests deletion of their data (GDPR)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { verifySignedRequest } from "@/lib/threads/verify-signature";

export async function POST(request: NextRequest) {
  let confirmationCode = "no_data";

  try {
    const body = await request.text();
    console.log("[Threads Data Deletion] Received:", body);

    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;

    const params = new URLSearchParams(body);
    const signedRequest = params.get("signed_request");

    if (!signedRequest) {
      return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
    }

    // Verify HMAC signature before processing
    const decoded = await verifySignedRequest<{ user_id?: string }>(
      signedRequest,
      env.THREADS_APP_SECRET,
    );

    if (!decoded) {
      console.warn("[Threads Data Deletion] Signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const threadsUserId = decoded.user_id;

    if (threadsUserId && db) {
      await db
        .prepare("DELETE FROM threads_accounts WHERE threads_user_id = ?")
        .bind(String(threadsUserId))
        .run();
      confirmationCode = `del_${threadsUserId}_${Date.now()}`;
      console.log("[Threads Data Deletion] Deleted data for user:", threadsUserId);
    }
  } catch (err) {
    console.error("[Threads Data Deletion] Error:", err);
  }

  // Meta expects a JSON response with a confirmation code and status URL
  return NextResponse.json({
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000"}/api/webhooks/threads/data-deletion/status`,
    confirmation_code: confirmationCode,
  });
}
