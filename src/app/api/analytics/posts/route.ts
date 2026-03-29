import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { posts, postMetrics, threadsAccounts } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { parsePeriodDays } from "@/lib/date-utils";

type SortField = "views" | "likes" | "replies" | "reposts" | "engagementRate" | "publishedAt";

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
    const sort = (searchParams.get("sort") || "views") as SortField;
    const parsedLimit = parseInt(searchParams.get("limit") || "50");
    const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 50 : Math.min(parsedLimit, 100);
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
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - days);
    const periodStartTimestamp = Math.floor(periodStart.getTime() / 1000);

    // Get all published posts in period with their latest metrics
    const rawRows = await db
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
          sql`${posts.publishedAt} >= ${periodStartTimestamp}`
        )
      )
      .orderBy(desc(postMetrics.fetchedAt));

    // Deduplicate to latest metrics per post
    const postMap = new Map<string, typeof rawRows[number]>();
    for (const row of rawRows) {
      if (!postMap.has(row.id)) {
        postMap.set(row.id, row);
      }
    }

    const postList = Array.from(postMap.values()).map((p) => {
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

    // Sort
    postList.sort((a, b) => {
      switch (sort) {
        case "views":
          return b.metrics.views - a.metrics.views;
        case "likes":
          return b.metrics.likes - a.metrics.likes;
        case "replies":
          return b.metrics.replies - a.metrics.replies;
        case "reposts":
          return b.metrics.reposts - a.metrics.reposts;
        case "engagementRate":
          return b.engagementRate - a.engagementRate;
        case "publishedAt":
          return new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime();
        default:
          return b.metrics.views - a.metrics.views;
      }
    });

    const limitedPosts = postList.slice(0, limit);

    // Media type breakdown
    const mediaTypeGroups: Record<string, {
      count: number;
      totalViews: number;
      totalLikes: number;
      totalEngagement: number;
    }> = {};

    for (const p of postList) {
      const mt = p.mediaType;
      if (!mediaTypeGroups[mt]) {
        mediaTypeGroups[mt] = { count: 0, totalViews: 0, totalLikes: 0, totalEngagement: 0 };
      }
      mediaTypeGroups[mt].count += 1;
      mediaTypeGroups[mt].totalViews += p.metrics.views;
      mediaTypeGroups[mt].totalLikes += p.metrics.likes;
      mediaTypeGroups[mt].totalEngagement += p.engagementRate;
    }

    const mediaTypeBreakdown = Object.entries(mediaTypeGroups).map(([mediaType, group]) => ({
      mediaType,
      count: group.count,
      avgViews: group.count > 0 ? Math.round(group.totalViews / group.count) : 0,
      avgLikes: group.count > 0 ? Math.round(group.totalLikes / group.count) : 0,
      avgEngagement: group.count > 0
        ? Math.round((group.totalEngagement / group.count) * 100) / 100
        : 0,
    }));

    return NextResponse.json({
      posts: limitedPosts,
      mediaTypeBreakdown,
    });
  } catch (error) {
    console.error("GET /api/analytics/posts error:", error);
    return NextResponse.json(
      { error: "投稿アナリティクスの取得に失敗しました" },
      { status: 500 }
    );
  }
}
