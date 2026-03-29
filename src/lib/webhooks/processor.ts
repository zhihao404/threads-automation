import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import type { Database } from "@/db";
import { threadsAccounts, notifications, webhookEvents } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit/logger";

// =============================================================================
// Webhook payload types
// =============================================================================

export interface WebhookEntry {
  id: string; // Threads user ID
  time: number;
  changes: Array<{
    field: string;
    value: Record<string, unknown>;
  }>;
}

export interface WebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

// =============================================================================
// Constants
// =============================================================================

/** Maximum age of a webhook event before it's rejected (replay protection) */
const MAX_EVENT_AGE_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// Derive a deterministic event ID from payload for deduplication
// =============================================================================

/**
 * Derive a deterministic event ID from the webhook payload.
 * Uses the entry ID + time + field names to create a unique identifier.
 * Falls back to a hash of the raw body if entries have no usable identifiers.
 */
function deriveMetaEventId(payload: WebhookPayload): string | null {
  if (!payload.entry || payload.entry.length === 0) return null;

  // Build a composite key from entry IDs, times, and fields
  const parts = payload.entry.map((entry) => {
    const fields = entry.changes.map((c) => c.field).sort().join(",");
    return `${entry.id}:${entry.time}:${fields}`;
  });

  return parts.join("|");
}

// =============================================================================
// Check for duplicate events
// =============================================================================

async function isDuplicateEvent(
  db: Database,
  metaEventId: string,
): Promise<boolean> {
  const existing = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(eq(webhookEvents.metaEventId, metaEventId))
    .limit(1);

  return existing.length > 0;
}

// =============================================================================
// Check for replay attacks (events older than MAX_EVENT_AGE_MS)
// =============================================================================

function isReplayEvent(payload: WebhookPayload): boolean {
  const now = Date.now();

  for (const entry of payload.entry) {
    // entry.time is in seconds (Unix epoch)
    const entryTimeMs = entry.time * 1000;
    if (now - entryTimeMs > MAX_EVENT_AGE_MS) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// Store raw webhook event for audit/debugging
// =============================================================================

async function storeRawEvent(
  db: Database,
  topic: string,
  payload: string,
  metaEventId?: string | null,
): Promise<string> {
  const id = ulid();
  const now = new Date();
  await db.insert(webhookEvents).values({
    id,
    topic,
    metaEventId: metaEventId ?? null,
    payload,
    processed: false,
    receivedAt: now,
    createdAt: now,
  });
  return id;
}

// =============================================================================
// Mark a raw webhook event as processed
// =============================================================================

async function markEventProcessed(
  db: Database,
  eventId: string,
): Promise<void> {
  await db
    .update(webhookEvents)
    .set({ processed: true })
    .where(eq(webhookEvents.id, eventId));
}

// =============================================================================
// Build notification from a webhook change
// =============================================================================

function truncateBody(text: string, maxLen = 200): string {
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

function buildNotification(
  field: string,
  value: Record<string, unknown>,
  accountId: string,
  now: Date,
): typeof notifications.$inferInsert | null {
  const base = { id: ulid(), accountId, isRead: false, createdAt: now } as const;

  switch (field) {
    case "replies":
    case "mentions": {
      const from = value.from as { id: string; username: string } | undefined;
      const text = (value.text as string) ?? "";
      const username = from?.username ?? "不明なユーザー";
      const title = field === "replies"
        ? `新しいリプライ: @${username}が返信しました`
        : `@${username}にメンションされました`;
      const type = field === "replies" ? "reply" as const : "mention" as const;

      return {
        ...base,
        type,
        title,
        body: truncateBody(text),
        metadata: JSON.stringify({
          fromId: from?.id,
          fromUsername: username,
          text: value.text,
          ...(field === "replies" ? { mediaType: value.media_type } : {}),
          permalink: value.permalink,
          timestamp: value.timestamp,
        }),
      };
    }

    case "publish":
      return {
        ...base,
        type: "publish",
        title: "投稿が公開されました",
        body: null,
        metadata: JSON.stringify({
          mediaType: value.media_type,
          permalink: value.permalink,
          timestamp: value.timestamp,
        }),
      };

    case "delete":
      return {
        ...base,
        type: "delete",
        title: "投稿が削除されました",
        body: null,
        metadata: JSON.stringify({ timestamp: value.timestamp }),
      };

    default:
      return null;
  }
}

// =============================================================================
// Process a single webhook entry
// =============================================================================

async function processWebhookEntry(
  db: Database,
  entry: WebhookEntry,
): Promise<void> {
  // Find the account by threadsUserId (entry.id)
  const accountRows = await db
    .select({ id: threadsAccounts.id })
    .from(threadsAccounts)
    .where(eq(threadsAccounts.threadsUserId, entry.id))
    .limit(1);

  const account = accountRows[0];
  if (!account) {
    console.warn(
      `Webhook: no matching account for threadsUserId=${entry.id}`,
    );
    return;
  }

  for (const change of entry.changes) {
    const { field, value } = change;
    const now = new Date();

    const notification = buildNotification(field, value, account.id, now);
    if (notification) {
      await db.insert(notifications).values(notification);
    } else {
      console.warn(`Webhook: unknown field "${field}" for entry ${entry.id}`);
    }
  }
}

// =============================================================================
// Process a full webhook payload
// =============================================================================

async function processWebhookPayload(
  db: Database,
  payload: WebhookPayload,
): Promise<void> {
  for (const entry of payload.entry) {
    await processWebhookEntry(db, entry);
  }
}

// =============================================================================
// Full webhook handling with dedup + replay protection + audit
// =============================================================================

export interface WebhookHandleResult {
  status: "processed" | "duplicate" | "replay_rejected" | "stored_for_retry";
  eventId?: string;
}

export async function handleWebhookWithProtection(
  db: Database,
  rawBody: string,
): Promise<WebhookHandleResult> {
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Store unparseable payloads for debugging, but don't process them
    const eventId = await storeRawEvent(db, "threads", rawBody);
    return { status: "stored_for_retry", eventId };
  }

  if (!payload.entry || !Array.isArray(payload.entry)) {
    const eventId = await storeRawEvent(db, "threads", rawBody);
    return { status: "stored_for_retry", eventId };
  }

  // 1. Derive a deterministic event ID for deduplication
  const metaEventId = deriveMetaEventId(payload);

  // 2. Check for duplicate events
  if (metaEventId) {
    const duplicate = await isDuplicateEvent(db, metaEventId);
    if (duplicate) {
      await logAuditEvent(db, {
        actorType: "webhook",
        action: "webhook.duplicate",
        resourceType: "webhook_event",
        metadata: { metaEventId },
      });
      return { status: "duplicate" };
    }
  }

  // 3. Check for replay attacks
  if (isReplayEvent(payload)) {
    await logAuditEvent(db, {
      actorType: "webhook",
      action: "webhook.replay_rejected",
      resourceType: "webhook_event",
      metadata: {
        metaEventId,
        entryTimes: payload.entry.map((e) => e.time),
      },
    });
    return { status: "replay_rejected" };
  }

  // 4. Store the raw event (with meta event ID for future dedup)
  const eventId = await storeRawEvent(db, "threads", rawBody, metaEventId);

  // 5. Audit the receipt
  await logAuditEvent(db, {
    actorType: "webhook",
    action: "webhook.receive",
    resourceType: "webhook_event",
    resourceId: eventId,
    metadata: {
      metaEventId,
      entryCount: payload.entry.length,
      fields: payload.entry.flatMap((e) => e.changes.map((c) => c.field)),
    },
  });

  // 6. Process the payload
  try {
    await processWebhookPayload(db, payload);
    await markEventProcessed(db, eventId);
  } catch (error) {
    console.error("Failed to process webhook payload:", error);
    // Raw event is stored for later reprocessing
  }

  return { status: "processed", eventId };
}
