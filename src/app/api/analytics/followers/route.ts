import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { accountMetrics, posts, threadsAccounts } from "@/db/schema";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
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
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - days);

    const periodStartStr = formatDateToYMD(periodStart);
    const nowStr = formatDateToYMD(now);

    // Get daily follower counts for the period
    const dailyMetrics = await db
      .select({
        date: accountMetrics.date,
        followersCount: accountMetrics.followersCount,
      })
      .from(accountMetrics)
      .where(
        and(
          eq(accountMetrics.accountId, accountId),
          gte(accountMetrics.date, periodStartStr),
          lte(accountMetrics.date, nowStr)
        )
      )
      .orderBy(accountMetrics.date);

    // Calculate daily changes
    const dailyGrowth: Array<{
      date: string;
      followers: number;
      change: number;
    }> = [];

    for (let i = 0; i < dailyMetrics.length; i++) {
      const current = dailyMetrics[i]!;
      const previous = i > 0 ? dailyMetrics[i - 1]! : null;
      const change = previous
        ? current.followersCount - previous.followersCount
        : 0;

      dailyGrowth.push({
        date: current.date,
        followers: current.followersCount,
        change,
      });
    }

    // Calculate summary
    const latestFollowers =
      dailyMetrics.length > 0
        ? dailyMetrics[dailyMetrics.length - 1]!.followersCount
        : 0;
    const startFollowers =
      dailyMetrics.length > 0 ? dailyMetrics[0]!.followersCount : 0;
    const totalChange = latestFollowers - startFollowers;
    const changePercent =
      startFollowers > 0
        ? Math.round((totalChange / startFollowers) * 10000) / 100
        : 0;

    // Growth contributors: find posts published in the period and correlate with follower gains
    const periodStartTimestamp = Math.floor(periodStart.getTime() / 1000);
    const nowTimestamp = Math.floor(now.getTime() / 1000);

    const publishedPosts = await db
      .select({
        id: posts.id,
        content: posts.content,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(
        and(
          eq(posts.accountId, accountId),
          eq(posts.status, "published"),
          sql`${posts.publishedAt} >= ${periodStartTimestamp}`,
          sql`${posts.publishedAt} <= ${nowTimestamp}`
        )
      )
      .orderBy(desc(posts.publishedAt));

    // Build a date-to-followers map for quick lookup
    const dateFollowersMap = new Map<string, number>();
    for (const m of dailyMetrics) {
      dateFollowersMap.set(m.date, m.followersCount);
    }

    // For each post, find the follower count on publish date and the day after
    const growthContributors: Array<{
      postId: string;
      content: string;
      publishedAt: string;
      followersBefore: number;
      followersAfter: number;
      gain: number;
    }> = [];

    for (const post of publishedPosts) {
      if (!post.publishedAt) continue;

      const publishDate = new Date(
        typeof post.publishedAt === "number"
          ? post.publishedAt * 1000
          : post.publishedAt
      );
      const publishDateStr = formatDateToYMD(publishDate);

      // Look at followers the day before and the day after
      const dayBefore = new Date(publishDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const dayAfter = new Date(publishDate);
      dayAfter.setDate(dayAfter.getDate() + 1);

      const followersBefore =
        dateFollowersMap.get(formatDateToYMD(dayBefore)) ??
        dateFollowersMap.get(publishDateStr) ??
        0;
      const followersAfter =
        dateFollowersMap.get(formatDateToYMD(dayAfter)) ??
        dateFollowersMap.get(publishDateStr) ??
        0;

      const gain = followersAfter - followersBefore;

      if (gain > 0) {
        growthContributors.push({
          postId: post.id,
          content: post.content,
          publishedAt: publishDate.toISOString(),
          followersBefore,
          followersAfter,
          gain,
        });
      }
    }

    // Sort by gain descending
    growthContributors.sort((a, b) => b.gain - a.gain);

    return NextResponse.json({
      current: latestFollowers,
      change: totalChange,
      changePercent,
      dailyGrowth,
      growthContributors: growthContributors.slice(0, 20),
    });
  } catch (error) {
    console.error("GET /api/analytics/followers error:", error);
    return NextResponse.json(
      { error: "フォロワー分析の取得に失敗しました" },
      { status: 500 }
    );
  }
}
