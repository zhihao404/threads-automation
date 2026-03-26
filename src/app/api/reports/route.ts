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
  reports,
} from "@/db/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { ulid } from "ulid";
import {
  generateReport,
  type ReportData,
  type ReportMetrics,
} from "@/lib/ai/report";
import { guardFeatureAccess } from "@/lib/plans/guard";
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

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// GET /api/reports?accountId=xxx&limit=10
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    // Get user's accounts
    const userAccounts = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(eq(threadsAccounts.userId, userId));

    if (userAccounts.length === 0) {
      return NextResponse.json({ reports: [] });
    }

    const accountIds = accountId
      ? userAccounts.filter((a) => a.id === accountId).map((a) => a.id)
      : userAccounts.map((a) => a.id);

    if (accountIds.length === 0) {
      return NextResponse.json(
        { error: "アカウントが見つかりません" },
        { status: 404 }
      );
    }

    const accountInClause = sql`${reports.accountId} IN (${sql.join(
      accountIds.map((id) => sql`${id}`),
      sql`, `
    )})`;

    const reportRows = await db
      .select({
        id: reports.id,
        accountId: reports.accountId,
        type: reports.type,
        title: reports.title,
        periodStart: reports.periodStart,
        periodEnd: reports.periodEnd,
        summary: reports.summary,
        status: reports.status,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .where(accountInClause)
      .orderBy(desc(reports.createdAt))
      .limit(limit);

    return NextResponse.json({
      reports: reportRows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return NextResponse.json(
      { error: "レポートの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST /api/reports - Generate a new report
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json();
    const { accountId, type } = body as {
      accountId: string;
      type: "weekly" | "monthly";
    };

    if (!accountId || !type || !["weekly", "monthly"].includes(type)) {
      return NextResponse.json(
        { error: "accountIdとtype（weekly/monthly）が必要です" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Check report feature access based on plan
    // "weekly" reports require at least "weekly" access, "monthly" requires "full"
    const requiredLevel = type === "monthly" ? "full" : "weekly";
    const featureResponse = await guardFeatureAccess(db, userId, "reports", requiredLevel);
    if (featureResponse) return featureResponse;

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

    const account = accountRows[0];

    // Calculate period
    const now = new Date();
    const days = type === "weekly" ? 7 : 30;
    const periodEnd = new Date(now);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - days);
    const previousStart = new Date(periodStart);
    previousStart.setDate(previousStart.getDate() - days);

    const periodStartStr = formatDate(periodStart);
    const periodEndStr = formatDate(periodEnd);
    const previousStartStr = formatDate(previousStart);

    // Create the report record with "generating" status
    const reportId = ulid();
    await db.insert(reports).values({
      id: reportId,
      accountId,
      type,
      title: `${type === "weekly" ? "週次" : "月次"}レポート生成中...`,
      periodStart: periodStartStr,
      periodEnd: periodEndStr,
      content: "",
      summary: "",
      metrics: "{}",
      status: "generating",
      createdAt: now,
    });

    try {
      // Fetch current period account metrics
      const currentAccountMetrics = await db
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
            gte(accountMetrics.date, periodStartStr),
            lte(accountMetrics.date, periodEndStr)
          )
        );

      // Fetch previous period account metrics
      const prevAccountMetrics = await db
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
            lte(accountMetrics.date, periodStartStr)
          )
        );

      // Fetch followers for start/end of current period
      const followersEnd = await db
        .select({ followersCount: accountMetrics.followersCount })
        .from(accountMetrics)
        .where(
          and(
            eq(accountMetrics.accountId, accountId),
            lte(accountMetrics.date, periodEndStr)
          )
        )
        .orderBy(desc(accountMetrics.date))
        .limit(1);

      const followersStart = await db
        .select({ followersCount: accountMetrics.followersCount })
        .from(accountMetrics)
        .where(
          and(
            eq(accountMetrics.accountId, accountId),
            lte(accountMetrics.date, periodStartStr)
          )
        )
        .orderBy(desc(accountMetrics.date))
        .limit(1);

      const followersEndCount = followersEnd[0]?.followersCount ?? 0;
      const followersStartCount = followersStart[0]?.followersCount ?? 0;

      // Fetch previous period followers
      const prevFollowersEnd = await db
        .select({ followersCount: accountMetrics.followersCount })
        .from(accountMetrics)
        .where(
          and(
            eq(accountMetrics.accountId, accountId),
            lte(accountMetrics.date, periodStartStr)
          )
        )
        .orderBy(desc(accountMetrics.date))
        .limit(1);

      const prevFollowersStart = await db
        .select({ followersCount: accountMetrics.followersCount })
        .from(accountMetrics)
        .where(
          and(
            eq(accountMetrics.accountId, accountId),
            lte(accountMetrics.date, previousStartStr)
          )
        )
        .orderBy(desc(accountMetrics.date))
        .limit(1);

      const prevFollowersEndCount = prevFollowersEnd[0]?.followersCount ?? 0;
      const prevFollowersStartCount = prevFollowersStart[0]?.followersCount ?? 0;

      // Fetch published posts with metrics for the current period
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
            sql`${posts.publishedAt} >= ${Math.floor(periodStart.getTime() / 1000)}`,
            sql`${posts.publishedAt} <= ${Math.floor(now.getTime() / 1000)}`
          )
        )
        .orderBy(desc(posts.publishedAt));

      // Fetch previous period published posts count
      const prevPublishedPosts = await db
        .select({
          id: posts.id,
          content: posts.content,
          mediaType: posts.mediaType,
        })
        .from(posts)
        .where(
          and(
            eq(posts.accountId, accountId),
            eq(posts.status, "published"),
            sql`${posts.publishedAt} >= ${Math.floor(previousStart.getTime() / 1000)}`,
            sql`${posts.publishedAt} < ${Math.floor(periodStart.getTime() / 1000)}`
          )
        );

      // Fetch metrics for current period posts
      const postIds = publishedPosts.map((p) => p.id);
      const metricsMap: Record<
        string,
        {
          views: number;
          likes: number;
          replies: number;
          reposts: number;
          quotes: number;
        }
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

      // Fetch metrics for previous period posts
      const prevPostIds = prevPublishedPosts.map((p) => p.id);
      const prevMetricsMap: Record<
        string,
        {
          views: number;
          likes: number;
          replies: number;
          reposts: number;
          quotes: number;
        }
      > = {};

      if (prevPostIds.length > 0) {
        const prevMetricsRows = await db
          .select()
          .from(postMetrics)
          .where(
            sql`${postMetrics.postId} IN (${sql.join(
              prevPostIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          )
          .orderBy(desc(postMetrics.fetchedAt));

        for (const m of prevMetricsRows) {
          if (!prevMetricsMap[m.postId]) {
            prevMetricsMap[m.postId] = {
              views: m.views,
              likes: m.likes,
              replies: m.replies,
              reposts: m.reposts,
              quotes: m.quotes,
            };
          }
        }
      }

      // Calculate engagement rates
      const postsWithMetrics = publishedPosts.map((p) => {
        const pm = metricsMap[p.id] || {
          views: 0,
          likes: 0,
          replies: 0,
          reposts: 0,
          quotes: 0,
        };
        const totalEngagement =
          pm.likes + pm.replies + pm.reposts + pm.quotes;
        const engagementRate =
          pm.views > 0 ? (totalEngagement / pm.views) * 100 : 0;
        return {
          content: p.content,
          mediaType: p.mediaType,
          views: pm.views,
          likes: pm.likes,
          replies: pm.replies,
          reposts: pm.reposts,
          quotes: pm.quotes,
          engagementRate,
        };
      });

      // Calculate aggregate metrics
      const totalViews = postsWithMetrics.reduce((s, p) => s + p.views, 0);
      const totalEngagement = postsWithMetrics.reduce(
        (s, p) => s + p.likes + p.replies + p.reposts + p.quotes,
        0
      );
      const avgEngagementRate =
        totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

      // Previous period aggregate engagement
      const prevPostsWithMetrics = prevPublishedPosts.map((p) => {
        const pm = prevMetricsMap[p.id] || {
          views: 0,
          likes: 0,
          replies: 0,
          reposts: 0,
          quotes: 0,
        };
        return pm;
      });
      const prevTotalViews = prevPostsWithMetrics.reduce(
        (s, p) => s + p.views,
        0
      );
      const prevTotalEngagement = prevPostsWithMetrics.reduce(
        (s, p) => s + p.likes + p.replies + p.reposts + p.quotes,
        0
      );
      const prevAvgEngagementRate =
        prevTotalViews > 0
          ? (prevTotalEngagement / prevTotalViews) * 100
          : 0;

      // Build metrics objects
      const currentMetrics: ReportMetrics = {
        totalViews: currentAccountMetrics[0]?.totalViews ?? 0,
        totalLikes: currentAccountMetrics[0]?.totalLikes ?? 0,
        totalReplies: currentAccountMetrics[0]?.totalReplies ?? 0,
        totalReposts: currentAccountMetrics[0]?.totalReposts ?? 0,
        totalQuotes: currentAccountMetrics[0]?.totalQuotes ?? 0,
        totalClicks: currentAccountMetrics[0]?.totalClicks ?? 0,
        postsPublished: publishedPosts.length,
        followersStart: followersStartCount,
        followersEnd: followersEndCount,
        followerChange: followersEndCount - followersStartCount,
        avgEngagementRate,
      };

      const previousMetrics: ReportMetrics = {
        totalViews: prevAccountMetrics[0]?.totalViews ?? 0,
        totalLikes: prevAccountMetrics[0]?.totalLikes ?? 0,
        totalReplies: prevAccountMetrics[0]?.totalReplies ?? 0,
        totalReposts: prevAccountMetrics[0]?.totalReposts ?? 0,
        totalQuotes: prevAccountMetrics[0]?.totalQuotes ?? 0,
        totalClicks: prevAccountMetrics[0]?.totalClicks ?? 0,
        postsPublished: prevPublishedPosts.length,
        followersStart: prevFollowersStartCount,
        followersEnd: prevFollowersEndCount,
        followerChange: prevFollowersEndCount - prevFollowersStartCount,
        avgEngagementRate: prevAvgEngagementRate,
      };

      // Top posts
      const topPosts = [...postsWithMetrics]
        .sort((a, b) => b.views - a.views)
        .slice(0, 5)
        .map((p) => ({
          content: p.content,
          views: p.views,
          likes: p.likes,
          replies: p.replies,
          engagementRate: p.engagementRate,
        }));

      // Daily trend
      const dailyTrendRows = await db
        .select({
          date: accountMetrics.date,
          views: sql<number>`COALESCE(SUM(${accountMetrics.views}), 0)`,
          likes: sql<number>`COALESCE(SUM(${accountMetrics.likes}), 0)`,
          replies: sql<number>`COALESCE(SUM(${accountMetrics.replies}), 0)`,
        })
        .from(accountMetrics)
        .where(
          and(
            eq(accountMetrics.accountId, accountId),
            gte(accountMetrics.date, periodStartStr),
            lte(accountMetrics.date, periodEndStr)
          )
        )
        .groupBy(accountMetrics.date)
        .orderBy(accountMetrics.date);

      const dailyTrend = dailyTrendRows.map((r) => ({
        date: r.date,
        views: r.views,
        likes: r.likes,
        replies: r.replies,
      }));

      // Media type breakdown
      const mediaTypes = ["TEXT", "IMAGE", "VIDEO", "CAROUSEL"] as const;
      const mediaTypeBreakdown: Array<{
        type: string;
        count: number;
        avgEngagement: number;
      }> = [];

      for (const mt of mediaTypes) {
        const postsOfType = postsWithMetrics.filter(
          (p) => p.mediaType === mt
        );
        if (postsOfType.length > 0) {
          const avgEng =
            postsOfType.reduce((s, p) => s + p.engagementRate, 0) /
            postsOfType.length;
          mediaTypeBreakdown.push({
            type: mt,
            count: postsOfType.length,
            avgEngagement: avgEng,
          });
        }
      }

      // Build report data
      const reportData: ReportData = {
        accountUsername: account.username,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        type,
        metrics: currentMetrics,
        previousMetrics,
        topPosts,
        dailyTrend,
        mediaTypeBreakdown,
      };

      // Generate the report
      const generatedReport = await generateReport(
        aiConfig,
        reportData
      );

      // Update the report record
      await db
        .update(reports)
        .set({
          title: generatedReport.title,
          content: generatedReport.htmlContent,
          summary: generatedReport.summary,
          metrics: JSON.stringify(currentMetrics),
          status: "completed",
        })
        .where(eq(reports.id, reportId));

      return NextResponse.json({
        report: {
          id: reportId,
          accountId,
          type,
          title: generatedReport.title,
          periodStart: periodStartStr,
          periodEnd: periodEndStr,
          summary: generatedReport.summary,
          highlights: generatedReport.highlights,
          recommendations: generatedReport.recommendations,
          status: "completed",
          createdAt: now.toISOString(),
        },
      });
    } catch (genError) {
      // Update report with failed status
      console.error("Report generation failed:", genError);
      await db
        .update(reports)
        .set({
          status: "failed",
          summary:
            genError instanceof Error
              ? genError.message
              : "レポート生成に失敗しました",
        })
        .where(eq(reports.id, reportId));

      throw genError;
    }
  } catch (error: unknown) {
    console.error("POST /api/reports error:", error);

    if (error && typeof error === "object" && "status" in error) {
      const apiError = error as { status: number };
      if (apiError.status === 429) {
        return NextResponse.json(
          {
            error:
              "リクエストが多すぎます。しばらく待ってからお試しください。",
          },
          { status: 429 }
        );
      }
    }

    const message =
      error instanceof Error
        ? error.message
        : "レポートの生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
