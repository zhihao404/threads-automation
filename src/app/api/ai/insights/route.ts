import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { createDb } from "@/db";
import {
  session,
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
import { AIConfigurationError, resolveAIProvider } from "@/lib/ai/provider";

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
        sql`${session.expiresAt} > ${Math.floor(Date.now() / 1000)}`
      )
    )
    .limit(1);

  return sessions[0]?.userId ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { accountId, period = "30d" } = body as {
      accountId: string;
      period?: "7d" | "30d" | "90d";
    };

    if (!accountId) {
      return NextResponse.json(
        { error: "アカウントIDが必要です" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

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
      return NextResponse.json(
        { error: "アカウントが見つかりません" },
        { status: 404 }
      );
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
      return NextResponse.json({ error: aiConfig.message }, { status: 503 });
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

    return NextResponse.json({ insights, accountData });
  } catch (error: unknown) {
    console.error("POST /api/ai/insights error:", error);

    if (error && typeof error === "object" && "status" in error) {
      const apiError = error as { status: number };
      if (apiError.status === 429) {
        return NextResponse.json(
          { error: "リクエストが多すぎます。しばらく待ってからお試しください。" },
          { status: 429 }
        );
      }
      if (apiError.status === 401) {
        return NextResponse.json(
          { error: "AIサービスの認証に失敗しました。APIキーを確認してください。" },
          { status: 500 }
        );
      }
    }

    const message =
      error instanceof Error ? error.message : "インサイトの生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
