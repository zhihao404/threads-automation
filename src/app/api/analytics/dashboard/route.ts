import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import {
  posts,
  postMetrics,
  threadsAccounts,
  accountMetrics,
} from "@/db/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";

function getPeriodDays(period: string): number {
  switch (period) {
    case "14d":
      return 14;
    case "30d":
      return 30;
    case "90d":
      return 90;
    default:
      return 7;
  }
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
    const period = searchParams.get("period") || "7d";
    const days = getPeriodDays(period);

    // Get user's accounts
    const userAccounts = await db
      .select({
        id: threadsAccounts.id,
        username: threadsAccounts.username,
        displayName: threadsAccounts.displayName,
        profilePictureUrl: threadsAccounts.profilePictureUrl,
      })
      .from(threadsAccounts)
      .where(eq(threadsAccounts.userId, userId));

    if (userAccounts.length === 0) {
      return NextResponse.json({
        accounts: [],
        kpi: {
          views: { current: 0, previous: 0, change: 0 },
          likes: { current: 0, previous: 0, change: 0 },
          replies: { current: 0, previous: 0, change: 0 },
          followers: { current: 0, change: 0 },
        },
        recentPosts: [],
        dailyMetrics: [],
        postsByStatus: { published: 0, scheduled: 0, draft: 0, failed: 0 },
      });
    }

    // Filter accounts
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

    // Calculate date ranges
    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - days);
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - days);

    const currentStartStr = formatDate(currentStart);
    const previousStartStr = formatDate(previousStart);
    const currentEndStr = formatDate(now);
    const previousEndStr = formatDate(currentStart);

    // 1. KPI: Current period metrics
    const currentMetrics = await db
      .select({
        totalViews: sql<number>`COALESCE(SUM(${accountMetrics.views}), 0)`,
        totalLikes: sql<number>`COALESCE(SUM(${accountMetrics.likes}), 0)`,
        totalReplies: sql<number>`COALESCE(SUM(${accountMetrics.replies}), 0)`,
      })
      .from(accountMetrics)
      .where(
        and(
          accountInClause,
          gte(accountMetrics.date, currentStartStr),
          lte(accountMetrics.date, currentEndStr)
        )
      );

    // 2. KPI: Previous period metrics
    const previousMetrics = await db
      .select({
        totalViews: sql<number>`COALESCE(SUM(${accountMetrics.views}), 0)`,
        totalLikes: sql<number>`COALESCE(SUM(${accountMetrics.likes}), 0)`,
        totalReplies: sql<number>`COALESCE(SUM(${accountMetrics.replies}), 0)`,
      })
      .from(accountMetrics)
      .where(
        and(
          accountInClause,
          gte(accountMetrics.date, previousStartStr),
          lte(accountMetrics.date, previousEndStr)
        )
      );

    // 3. KPI: Followers (latest record)
    const latestFollowers = await db
      .select({
        followersCount: accountMetrics.followersCount,
      })
      .from(accountMetrics)
      .where(accountInClause)
      .orderBy(desc(accountMetrics.date))
      .limit(1);

    // Previous followers: get the earliest record in the current period for change calculation
    const previousFollowers = await db
      .select({
        followersCount: accountMetrics.followersCount,
      })
      .from(accountMetrics)
      .where(
        and(
          accountInClause,
          lte(accountMetrics.date, currentStartStr)
        )
      )
      .orderBy(desc(accountMetrics.date))
      .limit(1);

    const currentViews = currentMetrics[0]?.totalViews ?? 0;
    const previousViews = previousMetrics[0]?.totalViews ?? 0;
    const currentLikes = currentMetrics[0]?.totalLikes ?? 0;
    const previousLikes = previousMetrics[0]?.totalLikes ?? 0;
    const currentReplies = currentMetrics[0]?.totalReplies ?? 0;
    const previousReplies = previousMetrics[0]?.totalReplies ?? 0;
    const currentFollowersCount = latestFollowers[0]?.followersCount ?? 0;
    const previousFollowersCount = previousFollowers[0]?.followersCount ?? 0;

    function calcChange(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 1000) / 10;
    }

    const kpi = {
      views: {
        current: currentViews,
        previous: previousViews,
        change: calcChange(currentViews, previousViews),
      },
      likes: {
        current: currentLikes,
        previous: previousLikes,
        change: calcChange(currentLikes, previousLikes),
      },
      replies: {
        current: currentReplies,
        previous: previousReplies,
        change: calcChange(currentReplies, previousReplies),
      },
      followers: {
        current: currentFollowersCount,
        change: currentFollowersCount - previousFollowersCount,
      },
    };

    // 4. Recent posts (last 10) with latest metrics
    const recentPostRows = await db
      .select({
        id: posts.id,
        content: posts.content,
        status: posts.status,
        mediaType: posts.mediaType,
        publishedAt: posts.publishedAt,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(postAccountInClause)
      .orderBy(desc(posts.createdAt))
      .limit(10);

    const publishedPostIds = recentPostRows
      .filter((p) => p.status === "published")
      .map((p) => p.id);

    const postMetricsMap: Record<
      string,
      { views: number; likes: number; replies: number }
    > = {};

    if (publishedPostIds.length > 0) {
      const metricsRows = await db
        .select({
          postId: postMetrics.postId,
          views: postMetrics.views,
          likes: postMetrics.likes,
          replies: postMetrics.replies,
          fetchedAt: postMetrics.fetchedAt,
        })
        .from(postMetrics)
        .where(
          sql`${postMetrics.postId} IN (${sql.join(
            publishedPostIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        )
        .orderBy(desc(postMetrics.fetchedAt));

      for (const m of metricsRows) {
        if (!postMetricsMap[m.postId]) {
          postMetricsMap[m.postId] = {
            views: m.views,
            likes: m.likes,
            replies: m.replies,
          };
        }
      }
    }

    const recentPosts = recentPostRows.map((p) => ({
      id: p.id,
      content: p.content,
      status: p.status,
      mediaType: p.mediaType,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      metrics: postMetricsMap[p.id] ?? null,
    }));

    // 5. Daily metrics for the period
    const dailyMetricsRows = await db
      .select({
        date: accountMetrics.date,
        views: sql<number>`COALESCE(SUM(${accountMetrics.views}), 0)`,
        likes: sql<number>`COALESCE(SUM(${accountMetrics.likes}), 0)`,
        replies: sql<number>`COALESCE(SUM(${accountMetrics.replies}), 0)`,
        reposts: sql<number>`COALESCE(SUM(${accountMetrics.reposts}), 0)`,
      })
      .from(accountMetrics)
      .where(
        and(
          accountInClause,
          gte(accountMetrics.date, currentStartStr),
          lte(accountMetrics.date, currentEndStr)
        )
      )
      .groupBy(accountMetrics.date)
      .orderBy(accountMetrics.date);

    const dailyMetrics = dailyMetricsRows.map((row) => ({
      date: row.date,
      views: row.views,
      likes: row.likes,
      replies: row.replies,
      reposts: row.reposts,
    }));

    // 6. Posts by status
    const statusCounts = await db
      .select({
        status: posts.status,
        count: sql<number>`COUNT(*)`,
      })
      .from(posts)
      .where(postAccountInClause)
      .groupBy(posts.status);

    const postsByStatus = {
      published: 0,
      scheduled: 0,
      draft: 0,
      failed: 0,
    };

    for (const row of statusCounts) {
      if (row.status in postsByStatus) {
        postsByStatus[row.status as keyof typeof postsByStatus] = row.count;
      }
    }

    return NextResponse.json({
      accounts: userAccounts,
      kpi,
      recentPosts,
      dailyMetrics,
      postsByStatus,
    });
  } catch (error) {
    console.error("GET /api/analytics/dashboard error:", error);
    return NextResponse.json(
      { error: "ダッシュボードデータの取得に失敗しました" },
      { status: 500 }
    );
  }
}
