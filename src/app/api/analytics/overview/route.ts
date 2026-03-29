import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { accountMetrics, posts, postMetrics, threadsAccounts } from "@/db/schema";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { formatDateToYMD, parsePeriodDays } from "@/lib/date-utils";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const period = searchParams.get("period") || "30d";
    const days = parsePeriodDays(period);

    if (!accountId) {
      return NextResponse.json(
        { error: "accountIdが必要です" },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const accountRows = await db
      .select({ id: threadsAccounts.id })
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

    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - days);
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - days);

    const currentStartStr = formatDateToYMD(currentStart);
    const previousStartStr = formatDateToYMD(previousStart);
    const currentEndStr = formatDateToYMD(now);
    const currentStartStrExclusive = formatDateToYMD(new Date(currentStart.getTime() - 86400000));

    // Get current period account metrics
    const currentMetrics = await db
      .select({
        totalViews: sql<number>`COALESCE(SUM(${accountMetrics.views}), 0)`,
        totalLikes: sql<number>`COALESCE(SUM(${accountMetrics.likes}), 0)`,
        totalReplies: sql<number>`COALESCE(SUM(${accountMetrics.replies}), 0)`,
        totalReposts: sql<number>`COALESCE(SUM(${accountMetrics.reposts}), 0)`,
        totalQuotes: sql<number>`COALESCE(SUM(${accountMetrics.quotes}), 0)`,
        totalClicks: sql<number>`COALESCE(SUM(${accountMetrics.clicks}), 0)`,
      })
      .from(accountMetrics)
      .where(
        and(
          eq(accountMetrics.accountId, accountId),
          gte(accountMetrics.date, currentStartStr),
          lte(accountMetrics.date, currentEndStr)
        )
      );

    // Get previous period account metrics
    const previousMetrics = await db
      .select({
        totalViews: sql<number>`COALESCE(SUM(${accountMetrics.views}), 0)`,
        totalLikes: sql<number>`COALESCE(SUM(${accountMetrics.likes}), 0)`,
        totalReplies: sql<number>`COALESCE(SUM(${accountMetrics.replies}), 0)`,
        totalReposts: sql<number>`COALESCE(SUM(${accountMetrics.reposts}), 0)`,
        totalQuotes: sql<number>`COALESCE(SUM(${accountMetrics.quotes}), 0)`,
        totalClicks: sql<number>`COALESCE(SUM(${accountMetrics.clicks}), 0)`,
      })
      .from(accountMetrics)
      .where(
        and(
          eq(accountMetrics.accountId, accountId),
          gte(accountMetrics.date, previousStartStr),
          lte(accountMetrics.date, currentStartStrExclusive)
        )
      );

    // Count posts published in current period
    const currentStartTimestamp = Math.floor(currentStart.getTime() / 1000);
    const nowTimestamp = Math.floor(now.getTime() / 1000);
    const previousStartTimestamp = Math.floor(previousStart.getTime() / 1000);

    const currentPostCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(
        and(
          eq(posts.accountId, accountId),
          eq(posts.status, "published"),
          sql`${posts.publishedAt} >= ${currentStartTimestamp}`,
          sql`${posts.publishedAt} <= ${nowTimestamp}`
        )
      );

    const previousPostCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(
        and(
          eq(posts.accountId, accountId),
          eq(posts.status, "published"),
          sql`${posts.publishedAt} >= ${previousStartTimestamp}`,
          sql`${posts.publishedAt} < ${currentStartTimestamp}`
        )
      );

    const cm = currentMetrics[0] ?? { totalLikes: 0, totalReplies: 0, totalReposts: 0, totalQuotes: 0, totalViews: 0, totalClicks: 0 };
    const pm = previousMetrics[0] ?? { totalLikes: 0, totalReplies: 0, totalReposts: 0, totalQuotes: 0, totalViews: 0, totalClicks: 0 };

    const currentEngagement = cm.totalLikes + cm.totalReplies + cm.totalReposts + cm.totalQuotes;
    const currentEngagementRate = cm.totalViews > 0
      ? (currentEngagement / cm.totalViews) * 100
      : 0;

    const previousEngagement = pm.totalLikes + pm.totalReplies + pm.totalReposts + pm.totalQuotes;
    const previousEngagementRate = pm.totalViews > 0
      ? (previousEngagement / pm.totalViews) * 100
      : 0;

    // Daily trend
    const dailyTrend = await db
      .select({
        date: accountMetrics.date,
        views: accountMetrics.views,
        likes: accountMetrics.likes,
        replies: accountMetrics.replies,
        reposts: accountMetrics.reposts,
        quotes: accountMetrics.quotes,
      })
      .from(accountMetrics)
      .where(
        and(
          eq(accountMetrics.accountId, accountId),
          gte(accountMetrics.date, currentStartStr),
          lte(accountMetrics.date, currentEndStr)
        )
      )
      .orderBy(accountMetrics.date);

    // Top posts with latest metrics for overview
    const topPostsRaw = await db
      .select({
        id: posts.id,
        content: posts.content,
        mediaType: posts.mediaType,
        publishedAt: posts.publishedAt,
        permalink: posts.permalink,
        metricId: postMetrics.id,
        views: postMetrics.views,
        likes: postMetrics.likes,
        replies: postMetrics.replies,
        reposts: postMetrics.reposts,
        quotes: postMetrics.quotes,
        shares: postMetrics.shares,
        fetchedAt: postMetrics.fetchedAt,
      })
      .from(posts)
      .innerJoin(postMetrics, eq(posts.id, postMetrics.postId))
      .where(
        and(
          eq(posts.accountId, accountId),
          eq(posts.status, "published"),
          sql`${posts.publishedAt} >= ${currentStartTimestamp}`
        )
      )
      .orderBy(desc(postMetrics.fetchedAt));

    // Deduplicate to latest metrics per post, then sort by views
    const postMap = new Map<string, typeof topPostsRaw[number]>();
    for (const row of topPostsRaw) {
      if (!postMap.has(row.id)) {
        postMap.set(row.id, row);
      }
    }
    const topPosts = Array.from(postMap.values())
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
      .map((p) => {
        const engagement = p.likes + p.replies + p.reposts + p.quotes;
        const engagementRate = p.views > 0 ? (engagement / p.views) * 100 : 0;
        return {
          id: p.id,
          content: p.content,
          mediaType: p.mediaType,
          publishedAt: p.publishedAt,
          permalink: p.permalink,
          metrics: {
            views: p.views,
            likes: p.likes,
            replies: p.replies,
            reposts: p.reposts,
            quotes: p.quotes,
            shares: p.shares,
          },
          engagementRate: Math.round(engagementRate * 100) / 100,
        };
      });

    return NextResponse.json({
      summary: {
        totalViews: cm.totalViews,
        totalLikes: cm.totalLikes,
        totalReplies: cm.totalReplies,
        totalReposts: cm.totalReposts,
        totalQuotes: cm.totalQuotes,
        totalClicks: cm.totalClicks,
        postsPublished: currentPostCount[0]?.count ?? 0,
        avgEngagementRate: Math.round(currentEngagementRate * 100) / 100,
      },
      previousSummary: {
        totalViews: pm.totalViews,
        totalLikes: pm.totalLikes,
        totalReplies: pm.totalReplies,
        totalReposts: pm.totalReposts,
        totalQuotes: pm.totalQuotes,
        totalClicks: pm.totalClicks,
        postsPublished: previousPostCount[0]?.count ?? 0,
        avgEngagementRate: Math.round(previousEngagementRate * 100) / 100,
      },
      dailyTrend,
      topPosts,
    });
  } catch (error) {
    console.error("GET /api/analytics/overview error:", error);
    return NextResponse.json(
      { error: "アナリティクスの取得に失敗しました" },
      { status: 500 }
    );
  }
}
