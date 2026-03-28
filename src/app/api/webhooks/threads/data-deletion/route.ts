// =============================================================================
// POST /api/webhooks/threads/data-deletion
// Called by Meta when a user requests deletion of their data (GDPR)
//
// Process: receive request -> verify signature -> identify user -> delete all
// data across all tables -> record audit trail -> return confirmation code
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, inArray } from "drizzle-orm";
import { ulid } from "ulid";
import { createDb } from "@/db";
import { verifySignedRequest } from "@/lib/threads/verify-signature";
import { logAuditEvent } from "@/lib/audit/logger";
import {
  threadsAccounts,
  posts,
  postMetrics,
  accountMetrics,
  postQueue,
  recurringSchedules,
  notifications,
  reports,
  publishAttempts,
  profileApiUsage,
  inboxItems,
  replyDrafts,
  replyDecisions,
  dataDeletions,
} from "@/db/schema";

export async function POST(request: NextRequest) {
  let confirmationCode = "no_data";

  try {
    const body = await request.text();
    console.log("[Threads Data Deletion] Received request");

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    const params = new URLSearchParams(body);
    const signedRequest = params.get("signed_request");

    if (!signedRequest) {
      return NextResponse.json(
        { error: "Missing signed_request" },
        { status: 400 },
      );
    }

    // Verify HMAC signature before processing
    const decoded = await verifySignedRequest<{ user_id?: string }>(
      signedRequest,
      env.THREADS_APP_SECRET,
    );

    if (!decoded) {
      console.warn("[Threads Data Deletion] Signature verification failed");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }

    const threadsUserId = decoded.user_id;

    if (!threadsUserId) {
      return NextResponse.json(
        { error: "Missing user_id in payload" },
        { status: 400 },
      );
    }

    const threadsUserIdStr = String(threadsUserId);
    confirmationCode = `del_${threadsUserIdStr}_${Date.now()}`;
    const now = new Date();

    // Create deletion tracking record
    const deletionId = ulid();
    await db.insert(dataDeletions).values({
      id: deletionId,
      threadsUserId: threadsUserIdStr,
      confirmationCode,
      status: "processing",
      requestedAt: now,
    });

    // Audit: log the deletion request
    await logAuditEvent(db, {
      actorType: "system",
      action: "data_deletion.request",
      resourceType: "account",
      resourceId: threadsUserIdStr,
      metadata: {
        confirmationCode,
        deletionId,
      },
    });

    // Find the threads account(s) for this user
    const accountRows = await db
      .select({ id: threadsAccounts.id, userId: threadsAccounts.userId })
      .from(threadsAccounts)
      .where(eq(threadsAccounts.threadsUserId, threadsUserIdStr));

    const tablesDeleted: string[] = [];

    if (accountRows.length > 0) {
      const accountIds = accountRows.map((a) => a.id);

      // Find all posts for these accounts (needed for cascading deletes)
      const postRows = await db
        .select({ id: posts.id })
        .from(posts)
        .where(inArray(posts.accountId, accountIds));
      const postIds = postRows.map((p) => p.id);

      // Find all inbox items for these accounts (needed for reply drafts/decisions)
      const inboxRows = await db
        .select({ id: inboxItems.id })
        .from(inboxItems)
        .where(inArray(inboxItems.threadsAccountId, accountIds));
      const inboxItemIds = inboxRows.map((i) => i.id);

      // Delete in dependency order (leaf tables first)

      // 1. Reply decisions (depends on inbox_items, reply_drafts)
      if (inboxItemIds.length > 0) {
        await db
          .delete(replyDecisions)
          .where(inArray(replyDecisions.inboxItemId, inboxItemIds));
        tablesDeleted.push("reply_decisions");

        // 2. Reply drafts (depends on inbox_items)
        await db
          .delete(replyDrafts)
          .where(inArray(replyDrafts.inboxItemId, inboxItemIds));
        tablesDeleted.push("reply_drafts");

        // 3. Inbox items
        await db
          .delete(inboxItems)
          .where(inArray(inboxItems.threadsAccountId, accountIds));
        tablesDeleted.push("inbox_items");
      }

      // 4. Post metrics (depends on posts)
      if (postIds.length > 0) {
        await db
          .delete(postMetrics)
          .where(inArray(postMetrics.postId, postIds));
        tablesDeleted.push("post_metrics");

        // 5. Publish attempts (depends on posts)
        await db
          .delete(publishAttempts)
          .where(inArray(publishAttempts.postId, postIds));
        tablesDeleted.push("publish_attempts");

        // 6. Post queue (depends on posts and accounts)
        await db
          .delete(postQueue)
          .where(inArray(postQueue.accountId, accountIds));
        tablesDeleted.push("post_queue");
      }

      // 7. Posts
      await db.delete(posts).where(inArray(posts.accountId, accountIds));
      tablesDeleted.push("posts");

      // 8. Account metrics
      await db
        .delete(accountMetrics)
        .where(inArray(accountMetrics.accountId, accountIds));
      tablesDeleted.push("account_metrics");

      // 9. Recurring schedules
      await db
        .delete(recurringSchedules)
        .where(inArray(recurringSchedules.accountId, accountIds));
      tablesDeleted.push("recurring_schedules");

      // 10. Notifications
      await db
        .delete(notifications)
        .where(inArray(notifications.accountId, accountIds));
      tablesDeleted.push("notifications");

      // 11. Reports
      await db
        .delete(reports)
        .where(inArray(reports.accountId, accountIds));
      tablesDeleted.push("reports");

      // 12. Profile API usage
      await db
        .delete(profileApiUsage)
        .where(inArray(profileApiUsage.threadsAccountId, accountIds));
      tablesDeleted.push("profile_api_usage");

      // 13. Threads accounts themselves
      await db
        .delete(threadsAccounts)
        .where(eq(threadsAccounts.threadsUserId, threadsUserIdStr));
      tablesDeleted.push("threads_accounts");
    }

    // Mark deletion as completed
    await db
      .update(dataDeletions)
      .set({
        status: "completed",
        tablesDeleted: JSON.stringify(tablesDeleted),
        completedAt: new Date(),
      })
      .where(eq(dataDeletions.id, deletionId));

    // Audit: log the deletion completion
    await logAuditEvent(db, {
      actorType: "system",
      action: "data_deletion.complete",
      resourceType: "account",
      resourceId: threadsUserIdStr,
      metadata: {
        confirmationCode,
        deletionId,
        tablesDeleted,
        accountsDeleted: accountRows.length,
      },
    });

    console.log(
      `[Threads Data Deletion] Completed for user ${threadsUserIdStr}. Tables: ${tablesDeleted.join(", ")}`,
    );
  } catch (err) {
    console.error("[Threads Data Deletion] Error:", err);
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";

  // Meta expects a JSON response with a confirmation code and status URL
  return NextResponse.json({
    url: `${appUrl}/api/webhooks/threads/data-deletion/status?code=${encodeURIComponent(confirmationCode)}`,
    confirmation_code: confirmationCode,
  });
}
