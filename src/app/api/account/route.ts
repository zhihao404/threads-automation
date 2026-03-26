import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import {
  users,
  session,
  account,
  threadsAccounts,
  posts,
  postMetrics,
  postTemplates,
  recurringSchedules,
  postQueue,
  accountMetrics,
  reports,
  notifications,
  subscriptions,
  usageRecords,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { cookies } from "next/headers";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";

/**
 * GET /api/account - Get user profile and plan info
 */
export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Get user info
    const userRows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = userRows[0];
    if (!user) {
      return NextResponse.json(
        { error: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    // Get subscription info
    const subRows = await db
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    const subscription = subRows[0] ?? { plan: "free", status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false };

    // Get connected Threads accounts
    const accountRows = await db
      .select({
        id: threadsAccounts.id,
        username: threadsAccounts.username,
        displayName: threadsAccounts.displayName,
        profilePictureUrl: threadsAccounts.profilePictureUrl,
        tokenExpiresAt: threadsAccounts.tokenExpiresAt,
      })
      .from(threadsAccounts)
      .where(eq(threadsAccounts.userId, userId));

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        createdAt: user.createdAt,
      },
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
      accounts: accountRows,
    });
  } catch (error) {
    console.error("GET /api/account error:", error);
    return NextResponse.json(
      { error: "アカウント情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/account - Update user profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as { name?: string };
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "名前を入力してください" },
        { status: 400 }
      );
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: "名前は100文字以内で入力してください" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    await db
      .update(users)
      .set({
        name: name.trim(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/account error:", error);
    return NextResponse.json(
      { error: "プロフィールの更新に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/account - Delete user account and all associated data
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as { confirmation?: string };
    const { confirmation } = body;

    if (confirmation !== "DELETE") {
      return NextResponse.json(
        { error: "確認テキストが正しくありません。\"DELETE\" と入力してください。" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Check for active Stripe subscription and cancel if needed
    const subRows = await db
      .select({
        stripeCustomerId: subscriptions.stripeCustomerId,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        plan: subscriptions.plan,
        status: subscriptions.status,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    const sub = subRows[0];
    if (
      sub?.stripeSubscriptionId &&
      sub.plan !== "free" &&
      (sub.status === "active" || sub.status === "trialing")
    ) {
      try {
        const { createStripeClient } = await import("@/lib/stripe/config");
        const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
        await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
      } catch (stripeError) {
        console.error("Failed to cancel Stripe subscription:", stripeError);
        // Continue with deletion even if Stripe cancellation fails
      }
    }

    // Get all Threads accounts for cascading deletes
    const userAccounts = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(eq(threadsAccounts.userId, userId));

    const accountIds = userAccounts.map((a) => a.id);

    // Get all post IDs across all accounts (needed for post metrics deletion)
    let postIds: string[] = [];
    if (accountIds.length > 0) {
      const allPosts = await db
        .select({ id: posts.id })
        .from(posts)
        .where(inArray(posts.accountId, accountIds));
      postIds = allPosts.map((p) => p.id);
    }

    // Build all delete operations for atomic batch execution
    // Order: children first (post_metrics, post_queue), then parents, then user
    const deleteOps: BatchItem<"sqlite">[] = [];

    // 1. Delete post metrics for all posts at once (fixes N+1)
    if (postIds.length > 0) {
      deleteOps.push(
        db.delete(postMetrics).where(inArray(postMetrics.postId, postIds))
      );
    }

    // 2. Delete account-scoped data
    if (accountIds.length > 0) {
      deleteOps.push(
        db.delete(postQueue).where(inArray(postQueue.accountId, accountIds)),
        db.delete(posts).where(inArray(posts.accountId, accountIds)),
        db.delete(accountMetrics).where(inArray(accountMetrics.accountId, accountIds)),
        db.delete(recurringSchedules).where(inArray(recurringSchedules.accountId, accountIds)),
        db.delete(reports).where(inArray(reports.accountId, accountIds)),
        db.delete(notifications).where(inArray(notifications.accountId, accountIds)),
        db.delete(threadsAccounts).where(eq(threadsAccounts.userId, userId)),
      );
    }

    // 3. Delete user-level data
    deleteOps.push(
      db.delete(postTemplates).where(eq(postTemplates.userId, userId)),
      db.delete(usageRecords).where(eq(usageRecords.userId, userId)),
      db.delete(subscriptions).where(eq(subscriptions.userId, userId)),
      db.delete(session).where(eq(session.userId, userId)),
      db.delete(account).where(eq(account.userId, userId)),
      db.delete(users).where(eq(users.id, userId)),
    );

    // Execute all deletes atomically in a single D1 batch
    await db.batch(
      deleteOps as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]
    );

    // Clear session cookie
    const cookieStore = await cookies();
    cookieStore.delete("better-auth.session_token");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/account error:", error);
    return NextResponse.json(
      { error: "アカウントの削除に失敗しました" },
      { status: 500 }
    );
  }
}
