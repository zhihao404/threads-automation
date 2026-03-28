import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import {
  threadsAccounts,
  posts,
  postMetrics,
  accountMetrics,
} from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  generateInsights,
  type AccountOverview,
  type PostPerformanceData,
} from "@/lib/ai/insights";
import { guardPlanLimit } from "@/lib/plans/guard";
import { incrementUsage } from "@/lib/plans/limits";
import { AIConfigurationError, resolveAIProvider } from "@/lib/ai/provider";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { apiError } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return apiError("認証が必要です", 401);
    }

    const body = await request.json();
    const { accountId, period = "30d" } = body as {
      accountId: string;
      period?: "7d" | "30d" | "90d";
    };

    if (!accountId) {
      return apiError("アカウントIDが必要です", 400);
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Rate limiting: 5 requests per minute
    const rateLimit = await checkRateLimit(db, userId, "ai/insights", 5, 60_000);
    if (!rateLimit.allowed) {
      return apiError(
        "リクエストが多すぎます。しばらく待ってからお試しください。",
        429,
        { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      );
    }

    // Check plan limit for AI generation
    const limitResponse = await guardPlanLimit(db, userId, "ai_generation");
    if (limitResponse) return limitResponse;

    // Verify account belongs to user
    const accountRows = await db
      .select()
      .from(threadsAccounts)
      .where(
        and(
          eq(threadsAccounts.id, accountId),
          eq(threadsAccounts.userId, userId)
        )
      )
      .limit(1);

    if (accountRows.length === 0) {
      return apiError("アカウントが見つかりません", 404);
    }

    const aiConfig = (() => {
      try {
        return resolveAIProvider(env);
      } catch (error) {
        if (error instanceof AIConfigurationError) {
          return error;
        }
        throw error;
      }
    })();

    if (aiConfig instanceof AIConfigurationError) {
      return apiError(aiConfig.message, 503);
    }

    // Calculate period start date
    const periodDays = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    // Fetch published posts with metrics for this account within the period
    const publishedPosts = await db
      .select({
        id: posts.id,
        content: posts.content,
        mediaType: posts.mediaType,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(
        and(
          eq(posts.accountId, accountId),
          eq(posts.status, "published"),
          sql`${posts.publishedAt} >= ${Math.floor(periodStart.getTime() / 1000)}`
        )
      )
      .orderBy(desc(posts.publishedAt));

    // Fetch latest metrics for each post
    const postIds = publishedPosts.map((p) => p.id);
    const metricsMap: Record<
      string,
      { views: number; likes: number; replies: number; reposts: number; quotes: number }
    > = {};

    if (postIds.length > 0) {
      const metricsRows = await db
        .select()
        .from(postMetrics)
        .where(
          sql`${postMetrics.postId} IN (${sql.join(
            postIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        )
        .orderBy(desc(postMetrics.fetchedAt));

      for (const m of metricsRows) {
        if (!metricsMap[m.postId]) {
          metricsMap[m.postId] = {
            views: m.views,
            likes: m.likes,
            replies: m.replies,
            reposts: m.reposts,
            quotes: m.quotes,
          };
        }
      }
    }

    // Fetch account metrics for follower trend
    const accountMetricsRows = await db
      .select()
      .from(accountMetrics)
      .where(eq(accountMetrics.accountId, accountId))
      .orderBy(desc(accountMetrics.date))
      .limit(periodDays);

    const latestFollowers =
      accountMetricsRows[0]?.followersCount ?? 0;
    const earliestFollowers =
      accountMetricsRows[accountMetricsRows.length - 1]?.followersCount ?? 0;
    const followersTrend = latestFollowers - earliestFollowers;

    // Build post performance data
    const postsWithMetrics: PostPerformanceData[] = publishedPosts.map((p) => ({
      content: p.content,
      mediaType: p.mediaType,
      publishedAt: p.publishedAt
        ? new Date(p.publishedAt).toISOString()
        : "",
      metrics: metricsMap[p.id] || {
        views: 0,
        likes: 0,
        replies: 0,
        reposts: 0,
        quotes: 0,
      },
    }));

    // Calculate averages
    const totalViews = postsWithMetrics.reduce(
      (sum, p) => sum + p.metrics.views,
      0
    );
    const totalLikes = postsWithMetrics.reduce(
      (sum, p) => sum + p.metrics.likes,
      0
    );
    const totalReplies = postsWithMetrics.reduce(
      (sum, p) => sum + p.metrics.replies,
      0
    );
    const postCount = postsWithMetrics.length || 1;

    // Calculate posts by hour and day
    const postsByHour: Record<number, number> = {};
    const postsByDay: Record<number, number> = {};

    for (const p of postsWithMetrics) {
      if (p.publishedAt) {
        const date = new Date(p.publishedAt);
        const hour = date.getHours();
        const day = date.getDay();
        postsByHour[hour] = (postsByHour[hour] || 0) + 1;
        postsByDay[day] = (postsByDay[day] || 0) + 1;
      }
    }

    // Sort top posts
    const topPostsByViews = [...postsWithMetrics]
      .sort((a, b) => b.metrics.views - a.metrics.views)
      .slice(0, 5);

    const topPostsByEngagement = [...postsWithMetrics]
      .sort(
        (a, b) =>
          b.metrics.likes +
          b.metrics.replies +
          b.metrics.reposts +
          b.metrics.quotes -
          (a.metrics.likes +
            a.metrics.replies +
            a.metrics.reposts +
            a.metrics.quotes)
      )
      .slice(0, 5);

    const accountData: AccountOverview = {
      totalPosts: postsWithMetrics.length,
      avgViews: Math.round(totalViews / postCount),
      avgLikes: Math.round(totalLikes / postCount),
      avgReplies: Math.round(totalReplies / postCount),
      followersCount: latestFollowers,
      followersTrend,
      topPostsByViews,
      topPostsByEngagement,
      postsByHour,
      postsByDay,
    };

    const insights = await generateInsights(aiConfig, accountData);

    await incrementUsage(db, userId, "ai_generation");

    return NextResponse.json({ insights, accountData });
  } catch (error: unknown) {
    console.error("POST /api/ai/insights error:", error);

    if (error && typeof error === "object" && "status" in error) {
      const apiErr = error as { status: number };
      if (apiErr.status === 429) {
        return apiError("リクエストが多すぎます。しばらく待ってからお試しください。", 429);
      }
      if (apiErr.status === 401) {
        return apiError("AIサービスの認証に失敗しました。APIキーを確認してください。", 500);
      }
    }

    return apiError("処理中にエラーが発生しました", 500);
  }
}
