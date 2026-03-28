import { eq, and, desc, gte, lte, type SQL } from "drizzle-orm";
import { ulid } from "ulid";
import type { Database } from "@/db";
import {
  inboxItems,
  replyDrafts,
  replyDecisions,
  threadsAccounts,
  type InboxItem,
  type ReplyDraft,
} from "@/db/schema";
import type { ThreadsClient } from "@/lib/threads/client";
import { resolveAIProvider, type AIProviderConfig } from "@/lib/ai/provider";
import { suggestReply, type ReplyTone } from "./ai-suggest";

// =============================================================================
// Types
// =============================================================================

export interface InboxFilters {
  status?: InboxItem["status"];
  itemType?: InboxItem["itemType"];
  /** Unix seconds - start of date range (inclusive) */
  since?: number;
  /** Unix seconds - end of date range (inclusive) */
  until?: number;
  /** Max items to return (default 50) */
  limit?: number;
  /** Offset for pagination (default 0) */
  offset?: number;
}

export interface InboxItemWithDrafts extends InboxItem {
  drafts: ReplyDraft[];
}

export interface GenerateDraftResult {
  draft: ReplyDraft;
  suggestion: {
    confidence: number;
    isSafe: boolean;
    safetyNote?: string;
  };
}

// =============================================================================
// Service Functions
// =============================================================================

/**
 * Retrieves inbox items for a given Threads account with optional filtering.
 * Results are ordered by reply timestamp descending (newest first).
 */
export async function getInboxItems(
  db: Database,
  accountId: string,
  filters: InboxFilters = {},
): Promise<{ items: InboxItemWithDrafts[]; total: number }> {
  const limit = Math.min(filters.limit ?? 50, 100);
  const offset = filters.offset ?? 0;

  // Build WHERE conditions
  const conditions: SQL[] = [eq(inboxItems.threadsAccountId, accountId)];

  if (filters.status) {
    conditions.push(eq(inboxItems.status, filters.status));
  }
  if (filters.itemType) {
    conditions.push(eq(inboxItems.itemType, filters.itemType));
  }
  if (filters.since !== undefined) {
    conditions.push(gte(inboxItems.replyTimestamp, filters.since));
  }
  if (filters.until !== undefined) {
    conditions.push(lte(inboxItems.replyTimestamp, filters.until));
  }

  const whereClause = and(...conditions);

  // Fetch items
  const items = await db
    .select()
    .from(inboxItems)
    .where(whereClause)
    .orderBy(desc(inboxItems.replyTimestamp))
    .limit(limit)
    .offset(offset);

  // Fetch drafts for all returned items
  const itemIds = items.map((item) => item.id);
  let draftsMap: Map<string, ReplyDraft[]> = new Map();

  if (itemIds.length > 0) {
    // Fetch all drafts for the returned items
    const allDrafts: ReplyDraft[] = [];
    for (const itemId of itemIds) {
      const draftsForItem = await db
        .select()
        .from(replyDrafts)
        .where(eq(replyDrafts.inboxItemId, itemId))
        .orderBy(desc(replyDrafts.createdAt));
      allDrafts.push(...draftsForItem);
    }

    draftsMap = new Map<string, ReplyDraft[]>();
    for (const draft of allDrafts) {
      const existing = draftsMap.get(draft.inboxItemId) ?? [];
      existing.push(draft);
      draftsMap.set(draft.inboxItemId, existing);
    }
  }

  const itemsWithDrafts: InboxItemWithDrafts[] = items.map((item) => ({
    ...item,
    drafts: draftsMap.get(item.id) ?? [],
  }));

  // Get total count for pagination
  const countResult = await db
    .select()
    .from(inboxItems)
    .where(whereClause);
  const total = countResult.length;

  return { items: itemsWithDrafts, total };
}

/**
 * Generates an AI reply draft for an inbox item.
 *
 * This creates a draft with `generated_by: 'ai'` and updates the inbox item
 * status to 'draft_ready'. The draft MUST be approved before sending.
 *
 * @param env - Cloudflare environment bindings for AI provider resolution
 */
export async function generateReplyDraft(
  db: Database,
  env: Partial<CloudflareEnv>,
  inboxItemId: string,
  userId: string,
  options?: { tone?: ReplyTone; language?: string; brandContext?: string },
): Promise<GenerateDraftResult> {
  // Fetch the inbox item
  const itemRows = await db
    .select()
    .from(inboxItems)
    .where(eq(inboxItems.id, inboxItemId))
    .limit(1);

  const item = itemRows[0];
  if (!item) {
    throw new Error("受信アイテムが見つかりません");
  }

  // We need the original post content. Fetch from the account's posts or use
  // a placeholder if the post content isn't locally available.
  // For now, we pass the threadsPostId as context; in production, this could
  // be enriched with a DB lookup to the posts table.
  const originalPostContent = `[Post ID: ${item.threadsPostId}]`;

  // Resolve AI provider from environment
  const aiConfig: AIProviderConfig = resolveAIProvider(env);

  const result = await suggestReply(
    aiConfig,
    originalPostContent,
    item.replyText,
    item.replyUsername,
    {
      tone: options?.tone ?? "friendly",
      language: options?.language ?? "ja",
      brandContext: options?.brandContext,
    },
  );

  // Abort if the AI generated unsafe content
  if (!result.suggestion.isSafe) {
    throw new Error(
      result.suggestion.safetyNote ??
        "AI生成コンテンツが安全性チェックに失敗しました",
    );
  }

  const now = new Date();
  const draftId = ulid();

  // Insert the draft
  const [draft] = await db
    .insert(replyDrafts)
    .values({
      id: draftId,
      inboxItemId: item.id,
      content: result.suggestion.content,
      generatedBy: "ai",
      aiModel: aiConfig.model,
      aiPrompt: `tone=${options?.tone ?? "friendly"}, lang=${options?.language ?? "ja"}`,
      createdBy: userId,
      createdAt: now,
    })
    .returning();

  // Update inbox item status to draft_ready
  await db
    .update(inboxItems)
    .set({ status: "draft_ready", updatedAt: now })
    .where(eq(inboxItems.id, item.id));

  return {
    draft: draft!,
    suggestion: {
      confidence: result.suggestion.confidence,
      isSafe: result.suggestion.isSafe,
      safetyNote: result.suggestion.safetyNote,
    },
  };
}

/**
 * Creates a manual reply draft for an inbox item.
 *
 * Used when a human writes the reply directly instead of using AI suggestions.
 */
export async function submitReplyDraft(
  db: Database,
  inboxItemId: string,
  content: string,
  userId: string,
): Promise<ReplyDraft> {
  // Validate inbox item exists
  const itemRows = await db
    .select()
    .from(inboxItems)
    .where(eq(inboxItems.id, inboxItemId))
    .limit(1);

  if (!itemRows[0]) {
    throw new Error("受信アイテムが見つかりません");
  }

  if (content.length === 0) {
    throw new Error("返信内容は空にできません");
  }

  if (content.length > 500) {
    throw new Error("返信内容は500文字以内にしてください");
  }

  const now = new Date();
  const draftId = ulid();

  const [draft] = await db
    .insert(replyDrafts)
    .values({
      id: draftId,
      inboxItemId,
      content,
      generatedBy: "manual",
      aiModel: null,
      aiPrompt: null,
      createdBy: userId,
      createdAt: now,
    })
    .returning();

  // Update inbox item status to draft_ready
  await db
    .update(inboxItems)
    .set({ status: "draft_ready", updatedAt: now })
    .where(eq(inboxItems.id, inboxItemId));

  return draft!;
}

/**
 * Approves a draft reply, marking the inbox item for sending.
 *
 * This records an approval decision and transitions the inbox item
 * status to 'approved'. The actual sending is done by `sendApprovedReply`.
 */
export async function approveReply(
  db: Database,
  inboxItemId: string,
  draftId: string,
  userId: string,
): Promise<void> {
  // Validate draft belongs to the inbox item
  const draftRows = await db
    .select()
    .from(replyDrafts)
    .where(
      and(
        eq(replyDrafts.id, draftId),
        eq(replyDrafts.inboxItemId, inboxItemId),
      ),
    )
    .limit(1);

  if (!draftRows[0]) {
    throw new Error("指定されたドラフトが見つかりません");
  }

  // Validate inbox item exists and is in an approvable state
  const itemRows = await db
    .select()
    .from(inboxItems)
    .where(eq(inboxItems.id, inboxItemId))
    .limit(1);

  const item = itemRows[0];
  if (!item) {
    throw new Error("受信アイテムが見つかりません");
  }

  if (item.status === "sent") {
    throw new Error("この受信アイテムは既に返信済みです");
  }

  if (item.status === "approved") {
    throw new Error("この受信アイテムは既に承認済みです");
  }

  const now = new Date();

  // Record the approval decision
  await db.insert(replyDecisions).values({
    id: ulid(),
    inboxItemId,
    replyDraftId: draftId,
    decision: "approve",
    decidedBy: userId,
    reason: null,
    createdAt: now,
  });

  // Update inbox item status to approved
  await db
    .update(inboxItems)
    .set({ status: "approved", updatedAt: now })
    .where(eq(inboxItems.id, inboxItemId));
}

/**
 * Rejects a draft reply with an optional reason.
 *
 * The inbox item remains in its current status (typically 'draft_ready')
 * so a new draft can be created.
 */
export async function rejectReply(
  db: Database,
  inboxItemId: string,
  draftId: string,
  userId: string,
  reason?: string,
): Promise<void> {
  // Validate draft belongs to the inbox item
  const draftRows = await db
    .select()
    .from(replyDrafts)
    .where(
      and(
        eq(replyDrafts.id, draftId),
        eq(replyDrafts.inboxItemId, inboxItemId),
      ),
    )
    .limit(1);

  if (!draftRows[0]) {
    throw new Error("指定されたドラフトが見つかりません");
  }

  const now = new Date();

  // Record the rejection decision
  await db.insert(replyDecisions).values({
    id: ulid(),
    inboxItemId,
    replyDraftId: draftId,
    decision: "reject",
    decidedBy: userId,
    reason: reason ?? null,
    createdAt: now,
  });

  // Reset status back to pending so a new draft can be generated
  await db
    .update(inboxItems)
    .set({ status: "pending", updatedAt: now })
    .where(eq(inboxItems.id, inboxItemId));
}

/**
 * Sends an approved reply via the Threads API.
 *
 * This is the final step in the approval workflow. It:
 * 1. Validates the inbox item is in 'approved' status
 * 2. Retrieves the approved draft
 * 3. Creates a text reply container via the Threads API
 * 4. Publishes the container
 * 5. Updates the inbox item status to 'sent'
 *
 * @throws Error if the inbox item is not in 'approved' status
 * @throws Error if there is no approved draft
 */
export async function sendApprovedReply(
  db: Database,
  threadsClient: ThreadsClient,
  inboxItemId: string,
): Promise<{ threadsMediaId: string }> {
  // Fetch inbox item
  const itemRows = await db
    .select()
    .from(inboxItems)
    .where(eq(inboxItems.id, inboxItemId))
    .limit(1);

  const item = itemRows[0];
  if (!item) {
    throw new Error("受信アイテムが見つかりません");
  }

  if (item.status !== "approved") {
    throw new Error(
      `送信できるのは承認済みアイテムのみです (現在のステータス: ${item.status})`,
    );
  }

  // Find the approved draft (the one referenced in the latest approve decision)
  const approvalRows = await db
    .select()
    .from(replyDecisions)
    .where(
      and(
        eq(replyDecisions.inboxItemId, inboxItemId),
        eq(replyDecisions.decision, "approve"),
      ),
    )
    .orderBy(desc(replyDecisions.createdAt))
    .limit(1);

  const approval = approvalRows[0];
  if (!approval?.replyDraftId) {
    throw new Error("承認済みのドラフトが見つかりません");
  }

  const draftRows = await db
    .select()
    .from(replyDrafts)
    .where(eq(replyDrafts.id, approval.replyDraftId))
    .limit(1);

  const draft = draftRows[0];
  if (!draft) {
    throw new Error("ドラフトが見つかりません");
  }

  // Send via Threads API: create container then publish
  const containerId = await threadsClient.createTextPost({
    text: draft.content,
    replyToId: item.threadsReplyId,
  });

  const published = await threadsClient.publishPost(containerId);

  // Update inbox item status to sent
  const now = new Date();
  await db
    .update(inboxItems)
    .set({ status: "sent", updatedAt: now })
    .where(eq(inboxItems.id, inboxItemId));

  return { threadsMediaId: published.id };
}

/**
 * Marks an inbox item as intentionally ignored.
 *
 * Records an 'ignore' decision for audit purposes. The item will no longer
 * appear in the active inbox.
 */
export async function ignoreInboxItem(
  db: Database,
  inboxItemId: string,
  userId: string,
): Promise<void> {
  const itemRows = await db
    .select()
    .from(inboxItems)
    .where(eq(inboxItems.id, inboxItemId))
    .limit(1);

  const item = itemRows[0];
  if (!item) {
    throw new Error("受信アイテムが見つかりません");
  }

  if (item.status === "sent") {
    throw new Error("既に返信済みのアイテムは無視できません");
  }

  const now = new Date();

  // Record the ignore decision
  await db.insert(replyDecisions).values({
    id: ulid(),
    inboxItemId,
    replyDraftId: null,
    decision: "ignore",
    decidedBy: userId,
    reason: null,
    createdAt: now,
  });

  // Update inbox item status
  await db
    .update(inboxItems)
    .set({ status: "ignored", updatedAt: now })
    .where(eq(inboxItems.id, inboxItemId));
}

/**
 * Hides a reply on Threads and records the decision.
 *
 * Uses the Threads API manage_reply endpoint to hide the reply,
 * then records the action in the reply_decisions table.
 */
export async function hideReply(
  db: Database,
  threadsClient: ThreadsClient,
  inboxItemId: string,
  userId: string,
): Promise<void> {
  const itemRows = await db
    .select()
    .from(inboxItems)
    .where(eq(inboxItems.id, inboxItemId))
    .limit(1);

  const item = itemRows[0];
  if (!item) {
    throw new Error("受信アイテムが見つかりません");
  }

  // Hide the reply on Threads
  await threadsClient.hideReply(item.threadsReplyId, true);

  const now = new Date();

  // Record the hide decision
  await db.insert(replyDecisions).values({
    id: ulid(),
    inboxItemId,
    replyDraftId: null,
    decision: "hide",
    decidedBy: userId,
    reason: null,
    createdAt: now,
  });

  // Update inbox item status
  await db
    .update(inboxItems)
    .set({ status: "hidden", updatedAt: now })
    .where(eq(inboxItems.id, inboxItemId));
}
