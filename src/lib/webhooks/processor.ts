import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import type { Database } from "@/db";
import { threadsAccounts, notifications, webhookEvents } from "@/db/schema";

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
// Store raw webhook event for audit/debugging
// =============================================================================

export async function storeRawEvent(
  db: Database,
  topic: string,
  payload: string,
): Promise<string> {
  const id = ulid();
  await db.insert(webhookEvents).values({
    id,
    topic,
    payload,
    processed: false,
    createdAt: new Date(),
  });
  return id;
}

// =============================================================================
// Mark a raw webhook event as processed
// =============================================================================

export async function markEventProcessed(
  db: Database,
  eventId: string,
): Promise<void> {
  await db
    .update(webhookEvents)
    .set({ processed: true })
    .where(eq(webhookEvents.id, eventId));
}

// =============================================================================
// Process a single webhook entry
// =============================================================================

export async function processWebhookEntry(
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

    switch (field) {
      case "replies": {
        const from = value.from as
          | { id: string; username: string }
          | undefined;
        const text = (value.text as string) ?? "";
        const username = from?.username ?? "不明なユーザー";

        await db.insert(notifications).values({
          id: ulid(),
          accountId: account.id,
          type: "reply",
          title: `新しいリプライ: @${username}が返信しました`,
          body: text.length > 200 ? text.slice(0, 200) + "..." : text,
          metadata: JSON.stringify({
            fromId: from?.id,
            fromUsername: username,
            text: value.text,
            mediaType: value.media_type,
            permalink: value.permalink,
            timestamp: value.timestamp,
          }),
          isRead: false,
          createdAt: now,
        });
        break;
      }

      case "mentions": {
        const from = value.from as
          | { id: string; username: string }
          | undefined;
        const text = (value.text as string) ?? "";
        const username = from?.username ?? "不明なユーザー";

        await db.insert(notifications).values({
          id: ulid(),
          accountId: account.id,
          type: "mention",
          title: `@${username}にメンションされました`,
          body: text.length > 200 ? text.slice(0, 200) + "..." : text,
          metadata: JSON.stringify({
            fromId: from?.id,
            fromUsername: username,
            text: value.text,
            permalink: value.permalink,
            timestamp: value.timestamp,
          }),
          isRead: false,
          createdAt: now,
        });
        break;
      }

      case "publish": {
        await db.insert(notifications).values({
          id: ulid(),
          accountId: account.id,
          type: "publish",
          title: "投稿が公開されました",
          body: null,
          metadata: JSON.stringify({
            mediaType: value.media_type,
            permalink: value.permalink,
            timestamp: value.timestamp,
          }),
          isRead: false,
          createdAt: now,
        });
        break;
      }

      case "delete": {
        await db.insert(notifications).values({
          id: ulid(),
          accountId: account.id,
          type: "delete",
          title: "投稿が削除されました",
          body: null,
          metadata: JSON.stringify({
            timestamp: value.timestamp,
          }),
          isRead: false,
          createdAt: now,
        });
        break;
      }

      default:
        console.warn(`Webhook: unknown field "${field}" for entry ${entry.id}`);
    }
  }
}

// =============================================================================
// Process a full webhook payload
// =============================================================================

export async function processWebhookPayload(
  db: Database,
  payload: WebhookPayload,
): Promise<void> {
  for (const entry of payload.entry) {
    await processWebhookEntry(db, entry);
  }
}
