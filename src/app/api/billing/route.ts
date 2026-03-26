import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { createDb } from "@/db";
import { session, usageRecords } from "@/db/schema";
import { PLANS } from "@/lib/stripe/config";
import {
  getUserPlan,
  getUserSubscription,
} from "@/lib/stripe/subscription";
import type { PlanType } from "@/lib/stripe/config";

async function getAuthenticatedUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("better-auth.session_token")?.value;
  if (!sessionToken) return null;

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  const sessions = await db
    .select({ userId: session.userId })
    .from(session)
    .where(
      and(
        eq(session.token, sessionToken),
        sql`${session.expiresAt} > ${Math.floor(Date.now() / 1000)}`,
      ),
    )
    .limit(1);

  return sessions[0]?.userId ?? null;
}

/**
 * Get the current billing period boundaries (YYYY-MM-DD).
 * Uses the subscription's currentPeriodStart/End if available,
 * otherwise defaults to the 1st through last day of the current month.
 */
function getCurrentPeriod(subscription: { currentPeriodStart: Date | null; currentPeriodEnd: Date | null } | null) {
  if (subscription?.currentPeriodStart && subscription?.currentPeriodEnd) {
    const start = subscription.currentPeriodStart;
    const end = subscription.currentPeriodEnd;
    return {
      periodStart: formatDate(start),
      periodEnd: formatDate(end),
    };
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    periodStart: formatDate(start),
    periodEnd: formatDate(end),
  };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    const [plan, subscription] = await Promise.all([
      getUserPlan(db, userId),
      getUserSubscription(db, userId),
    ]);

    const limits = PLANS[plan as PlanType].limits;
    const { periodStart, periodEnd } = getCurrentPeriod(subscription);

    // Fetch usage records for the current period
    const usageRows = await db
      .select({
        type: usageRecords.type,
        count: usageRecords.count,
      })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.userId, userId),
          eq(usageRecords.periodStart, periodStart),
        ),
      );

    const usage: Record<string, number> = {
      post: 0,
      ai_generation: 0,
      schedule: 0,
      template: 0,
    };

    for (const row of usageRows) {
      usage[row.type] = row.count;
    }

    return NextResponse.json({
      plan,
      planName: PLANS[plan as PlanType].name,
      planNameJa: PLANS[plan as PlanType].nameJa,
      price: PLANS[plan as PlanType].price,
      status: subscription?.status ?? "active",
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      currentPeriodStart: subscription?.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      hasStripeSubscription: !!subscription?.stripeSubscriptionId,
      limits: {
        accounts: limits.accounts,
        postsPerMonth: limits.postsPerMonth,
        scheduledPosts: limits.scheduledPosts,
        aiGenerations: limits.aiGenerations,
        templates: limits.templates,
        analytics: limits.analytics,
        reports: limits.reports,
        replyManagement: limits.replyManagement,
      },
      usage: {
        posts: usage.post,
        aiGenerations: usage.ai_generation,
        scheduledPosts: usage.schedule,
        templates: usage.template,
      },
      periodStart,
      periodEnd,
    });
  } catch (error) {
    console.error("GET /api/billing error:", error);
    return NextResponse.json(
      { error: "請求情報の取得に失敗しました" },
      { status: 500 },
    );
  }
}
