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

// ---------------------------------------------------------------------------
// Verify the X-Hub-Signature-256 header from Meta using HMAC-SHA256
// ---------------------------------------------------------------------------
async function verifySignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody),
  );

  // Convert computed signature to hex string
  const computedHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expectedHex = signatureHeader.slice("sha256=".length);

  // Timing-safe comparison: convert both to ArrayBuffers and use subtle.timingSafeEqual-style
  // comparison by checking equal-length buffers byte-by-byte with constant-time logic
  if (computedHex.length !== expectedHex.length) {
    return false;
  }

  const computedBytes = encoder.encode(computedHex);
  const expectedBytes = encoder.encode(expectedHex);

  // Constant-time comparison to prevent timing attacks
  let diff = 0;
  for (let i = 0; i < computedBytes.length; i++) {
    diff |= computedBytes[i] ^ expectedBytes[i];
  }
  return diff === 0;
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Verify webhook signature from Meta
  const signatureHeader = request.headers.get("X-Hub-Signature-256");
  const isValid = await verifySignature(
    env.THREADS_APP_SECRET,
    rawBody,
    signatureHeader,
  );

  if (!isValid) {
    console.warn("Webhook signature verification failed");
    return new Response("Unauthorized", { status: 401 });
  }

  const db = createDb(env.DB);

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
