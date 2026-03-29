import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import {
  posts,
  postMetrics,
  accountMetrics,
  threadsAccounts,
} from "@/db/schema";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { formatDateToYMD } from "@/lib/date-utils";

function getPeriodDays(period: string): number {
  switch (period) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    default:
      return 30;
  }
}

function emptyResponse() {
  return {
    engagementByType: {
      likes: 0,
      replies: 0,
      reposts: 0,
      quotes: 0,
      shares: 0,
    },
    dailyEngagementRate: [],
    hourlyPerformance: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      postCount: 0,
      avgViews: 0,
      avgLikes: 0,
      avgReplies: 0,
      avgEngagementRate: 0,
    })),
    dailyPerformance: Array.from({ length: 7 }, (_, day) => ({
      day,
      postCount: 0,
      avgViews: 0,
      avgLikes: 0,
      avgEngagementRate: 0,
    })),
    mediaTypePerformance: [],
    topPosts: [],
  };
}

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
    const accountIdParam = searchParams.get("accountId");
    const period = searchParams.get("period") || "30d";
    const days = getPeriodDays(period);

    // Get user's accounts
    const userAccounts = await db
      .select({
        id: threadsAccounts.id,
        username: threadsAccounts.username,
      })
      .from(threadsAccounts)
      .where(eq(threadsAccounts.userId, userId));

    if (userAccounts.length === 0) {
      return NextResponse.json(emptyResponse());
    }

    const targetAccountIds = accountIdParam
      ? userAccounts.filter((a) => a.id === accountIdParam).map((a) => a.id)
      : userAccounts.map((a) => a.id);

    if (targetAccountIds.length === 0) {
      return NextResponse.json(
        { error: "アカウントが見つかりません" },
        { status: 404 }
      );
    }

    const accountInClause = sql`${accountMetrics.accountId} IN (${sql.join(
      targetAccountIds.map((id) => sql`${id}`),
      sql`, `
    )})`;

    const postAccountInClause = sql`${posts.accountId} IN (${sql.join(
      targetAccountIds.map((id) => sql`${id}`),
      sql`, `
    )})`;

    // Date ranges
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = formatDateToYMD(startDate);
    const endDateStr = formatDateToYMD(now);
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    // =========================================================================
    // 1. Engagement breakdown by type (from accountMetrics)
    // =========================================================================
    const engagementTotals = await db
      .select({
        totalLikes: sql<number>`COALESCE(SUM(${accountMetrics.likes}), 0)`,
        totalReplies: sql<number>`COALESCE(SUM(${accountMetrics.replies}), 0)`,
        totalReposts: sql<number>`COALESCE(SUM(${accountMetrics.reposts}), 0)`,
        totalQuotes: sql<number>`COALESCE(SUM(${accountMetrics.quotes}), 0)`,
      })
      .from(accountMetrics)
      .where(
        and(
          accountInClause,
          gte(accountMetrics.date, startDateStr),
          lte(accountMetrics.date, endDateStr)
        )
      );

    // Shares from postMetrics (latest per post, for posts in period)
    const sharesResult = await db
      .select({
        totalShares: sql<number>`COALESCE(SUM(sub.shares), 0)`,
      })
      .from(
        sql`(
          SELECT pm1.shares
          FROM post_metrics pm1
          INNER JOIN (
            SELECT post_id, MAX(fetched_at) as max_fetched_at
            FROM post_metrics
            GROUP BY post_id
          ) pm2 ON pm1.post_id = pm2.post_id AND pm1.fetched_at = pm2.max_fetched_at
          INNER JOIN posts p ON p.id = pm1.post_id
          WHERE ${postAccountInClause}
            AND p.status = 'published'
            AND p.published_at >= ${startTimestamp}
        ) sub`
      );

    const engagementByType = {
      likes: engagementTotals[0]?.totalLikes ?? 0,
      replies: engagementTotals[0]?.totalReplies ?? 0,
      reposts: engagementTotals[0]?.totalReposts ?? 0,
      quotes: engagementTotals[0]?.totalQuotes ?? 0,
      shares: sharesResult[0]?.totalShares ?? 0,
    };

    // =========================================================================
    // 2. Daily engagement rate trend
    // =========================================================================
    const dailyMetricsRows = await db
      .select({
        date: accountMetrics.date,
        views: sql<number>`COALESCE(SUM(${accountMetrics.views}), 0)`,
        likes: sql<number>`COALESCE(SUM(${accountMetrics.likes}), 0)`,
        replies: sql<number>`COALESCE(SUM(${accountMetrics.replies}), 0)`,
        reposts: sql<number>`COALESCE(SUM(${accountMetrics.reposts}), 0)`,
        quotes: sql<number>`COALESCE(SUM(${accountMetrics.quotes}), 0)`,
      })
      .from(accountMetrics)
      .where(
        and(
          accountInClause,
          gte(accountMetrics.date, startDateStr),
          lte(accountMetrics.date, endDateStr)
        )
      )
      .groupBy(accountMetrics.date)
      .orderBy(accountMetrics.date);

    const dailyEngagementRate = dailyMetricsRows.map((row) => {
      const totalEng = row.likes + row.replies + row.reposts + row.quotes;
      const rate = row.views > 0 ? (totalEng / row.views) * 100 : 0;
      return {
        date: row.date,
        engagementRate: Math.round(rate * 100) / 100,
        views: row.views,
        likes: row.likes,
        replies: row.replies,
      };
    });

    // =========================================================================
    // 3. Get published posts with latest metrics for hour/day/media analysis
    // =========================================================================
    // Use a wider window for hourly/daily analysis (at least 90 days)
    const analysisStart = new Date(now);
    analysisStart.setDate(analysisStart.getDate() - Math.max(days, 90));
    const analysisStartTimestamp = Math.floor(analysisStart.getTime() / 1000);

    const postRows = await db
      .select({
        id: posts.id,
        content: posts.content,
        mediaType: posts.mediaType,
        publishedAt: posts.publishedAt,
        permalink: posts.permalink,
      })
      .from(posts)
      .where(
        and(
          postAccountInClause,
          eq(posts.status, "published"),
          sql`${posts.publishedAt} >= ${analysisStartTimestamp}`
        )
      )
      .orderBy(desc(posts.publishedAt));

    const postIds = postRows.map((p) => p.id);

    type MetricData = {
      views: number;
      likes: number;
      replies: number;
      reposts: number;
      quotes: number;
      shares: number;
    };

    const metricsMap: Record<string, MetricData> = {};

    if (postIds.length > 0) {
      const metricsRows = await db
        .select({
          postId: postMetrics.postId,
          views: postMetrics.views,
          likes: postMetrics.likes,
          replies: postMetrics.replies,
          reposts: postMetrics.reposts,
          quotes: postMetrics.quotes,
          shares: postMetrics.shares,
          fetchedAt: postMetrics.fetchedAt,
        })
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
            shares: m.shares,
          };
        }
      }
    }

    // =========================================================================
    // 4. Hourly performance
    // =========================================================================
    const hourlyBuckets: Record<
      number,
      {
        postCount: number;
        totalViews: number;
        totalLikes: number;
        totalReplies: number;
        totalEngagement: number;
      }
    > = {};
    for (let h = 0; h < 24; h++) {
      hourlyBuckets[h] = {
        postCount: 0,
        totalViews: 0,
        totalLikes: 0,
        totalReplies: 0,
        totalEngagement: 0,
      };
    }

    // =========================================================================
    // 5. Daily performance (day of week)
    // =========================================================================
    const dayBuckets: Record<
      number,
      {
        postCount: number;
        totalViews: number;
        totalLikes: number;
        totalEngagement: number;
      }
    > = {};
    for (let d = 0; d < 7; d++) {
      dayBuckets[d] = {
        postCount: 0,
        totalViews: 0,
        totalLikes: 0,
        totalEngagement: 0,
      };
    }

    // =========================================================================
    // 6. Media type performance
    // =========================================================================
    const mediaBuckets: Record<
      string,
      {
        postCount: number;
        totalViews: number;
        totalLikes: number;
        totalReplies: number;
        totalReposts: number;
        totalEngagement: number;
      }
    > = {};

    // Process all posts for hourly/daily/media analysis
    for (const post of postRows) {
      if (!post.publishedAt) continue;
      const m = metricsMap[post.id];
      if (!m) continue;

      const pubDate =
        post.publishedAt instanceof Date
          ? post.publishedAt
          : new Date(Number(post.publishedAt) * 1000);
      const hour = pubDate.getHours();
      const dayOfWeek = pubDate.getDay(); // 0=Sun
      const eng = m.likes + m.replies + m.reposts + m.quotes;

      // Hourly
      const hBucket = hourlyBuckets[hour];
      if (hBucket) {
        hBucket.postCount++;
        hBucket.totalViews += m.views;
        hBucket.totalLikes += m.likes;
        hBucket.totalReplies += m.replies;
        hBucket.totalEngagement += eng;
      }

      // Daily
      const dBucket = dayBuckets[dayOfWeek];
      if (dBucket) {
        dBucket.postCount++;
        dBucket.totalViews += m.views;
        dBucket.totalLikes += m.likes;
        dBucket.totalEngagement += eng;
      }

      // Media type
      const mt = post.mediaType;
      if (!mediaBuckets[mt]) {
        mediaBuckets[mt] = {
          postCount: 0,
          totalViews: 0,
          totalLikes: 0,
          totalReplies: 0,
          totalReposts: 0,
          totalEngagement: 0,
        };
      }
      const mBucket = mediaBuckets[mt];
      if (mBucket) {
        mBucket.postCount++;
        mBucket.totalViews += m.views;
        mBucket.totalLikes += m.likes;
        mBucket.totalReplies += m.replies;
        mBucket.totalReposts += m.reposts;
        mBucket.totalEngagement += eng;
      }
    }

    const hourlyPerformance = Array.from({ length: 24 }, (_, hour) => {
      const b = hourlyBuckets[hour]!;
      if (b.postCount === 0) {
        return {
          hour,
          postCount: 0,
          avgViews: 0,
          avgLikes: 0,
          avgReplies: 0,
          avgEngagementRate: 0,
        };
      }
      const avgViews = Math.round(b.totalViews / b.postCount);
      return {
        hour,
        postCount: b.postCount,
        avgViews,
        avgLikes: Math.round(b.totalLikes / b.postCount),
        avgReplies: Math.round(b.totalReplies / b.postCount),
        avgEngagementRate:
          avgViews > 0
            ? Math.round(
                (b.totalEngagement / b.postCount / avgViews) * 10000
              ) / 100
            : 0,
      };
    });

    const dailyPerformance = Array.from({ length: 7 }, (_, day) => {
      const b = dayBuckets[day]!;
      if (b.postCount === 0) {
        return {
          day,
          postCount: 0,
          avgViews: 0,
          avgLikes: 0,
          avgEngagementRate: 0,
        };
      }
      const avgViews = Math.round(b.totalViews / b.postCount);
      return {
        day,
        postCount: b.postCount,
        avgViews,
        avgLikes: Math.round(b.totalLikes / b.postCount),
        avgEngagementRate:
          avgViews > 0
            ? Math.round(
                (b.totalEngagement / b.postCount / avgViews) * 10000
              ) / 100
            : 0,
      };
    });

    const mediaTypePerformance = Object.entries(mediaBuckets).map(
      ([mediaType, b]) => {
        const avgViews =
          b.postCount > 0 ? Math.round(b.totalViews / b.postCount) : 0;
        return {
          mediaType,
          postCount: b.postCount,
          avgViews,
          avgLikes:
            b.postCount > 0 ? Math.round(b.totalLikes / b.postCount) : 0,
          avgReplies:
            b.postCount > 0 ? Math.round(b.totalReplies / b.postCount) : 0,
          avgReposts:
            b.postCount > 0 ? Math.round(b.totalReposts / b.postCount) : 0,
          avgEngagementRate:
            avgViews > 0
              ? Math.round(
                  (b.totalEngagement / b.postCount / avgViews) * 10000
                ) / 100
              : 0,
        };
      }
    );

    // =========================================================================
    // 7. Top posts by engagement rate (top 10, from current period only)
    // =========================================================================
    const topPosts = postRows
      .filter((p) => {
        if (!p.publishedAt) return false;
        const pubDate =
          p.publishedAt instanceof Date
            ? p.publishedAt
            : new Date(Number(p.publishedAt) * 1000);
        return pubDate.getTime() >= startDate.getTime();
      })
      .map((post) => {
        const m = metricsMap[post.id];
        if (!m) return null;
        const eng = m.likes + m.replies + m.reposts + m.quotes;
        const rate = m.views > 0 ? (eng / m.views) * 100 : 0;
        return {
          id: post.id,
          content: post.content,
          mediaType: post.mediaType,
          publishedAt: post.publishedAt
            ? post.publishedAt instanceof Date
              ? post.publishedAt.toISOString()
              : new Date(Number(post.publishedAt) * 1000).toISOString()
            : "",
          permalink: post.permalink,
          metrics: {
            views: m.views,
            likes: m.likes,
            replies: m.replies,
            reposts: m.reposts,
            quotes: m.quotes,
          },
          engagementRate: Math.round(rate * 100) / 100,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 10);

    return NextResponse.json({
      engagementByType,
      dailyEngagementRate,
      hourlyPerformance,
      dailyPerformance,
      mediaTypePerformance,
      topPosts,
    });
  } catch (error) {
    console.error("GET /api/analytics/engagement error:", error);
    return NextResponse.json(
      { error: "エンゲージメントデータの取得に失敗しました" },
      { status: 500 }
    );
  }
}
