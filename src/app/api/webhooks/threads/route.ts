import { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import {
  storeRawEvent,
  markEventProcessed,
  processWebhookPayload,
  type WebhookPayload,
} from "@/lib/webhooks/processor";

// =============================================================================
// GET /api/webhooks/threads - Verification challenge
// Meta sends: ?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
// =============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!mode || !token || !challenge) {
    return new Response("Missing parameters", { status: 400 });
  }

  const { env } = await getCloudflareContext({ async: true });

  if (mode === "subscribe" && token === env.WEBHOOK_VERIFY_TOKEN) {
    console.log("Webhook verification successful");
    return new Response(challenge, { status: 200 });
  }

  console.warn("Webhook verification failed: invalid token");
  return new Response("Forbidden", { status: 403 });
}

// =============================================================================
// POST /api/webhooks/threads - Receive notifications
// Must respond with 200 quickly to acknowledge receipt
// =============================================================================

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Store the raw event immediately for audit/debugging
  let eventId: string;
  try {
    eventId = await storeRawEvent(db, "threads", rawBody);
  } catch (error) {
    console.error("Failed to store raw webhook event:", error);
    // Still return 200 to prevent Meta from retrying
    return new Response("OK", { status: 200 });
  }

  // Parse and process the payload
  try {
    const payload: WebhookPayload = JSON.parse(rawBody);

    if (!payload.entry || !Array.isArray(payload.entry)) {
      console.warn("Webhook: invalid payload structure, no entry array");
      return new Response("OK", { status: 200 });
    }

    await processWebhookPayload(db, payload);
    await markEventProcessed(db, eventId);
  } catch (error) {
    console.error("Failed to process webhook payload:", error);
    // Return 200 anyway - we have the raw event stored for later reprocessing
  }

  return new Response("OK", { status: 200 });
}
