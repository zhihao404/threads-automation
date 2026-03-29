// =============================================================================
// Report Generation Handler
// Collects account data and generates an AI-powered report
// =============================================================================

import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import type { GenerateReportMessage } from "../../src/lib/queue/types";
import type { Env } from "../types";
import { createWorkerDb, type WorkerDatabase } from "../db";
import {
  threadsAccounts,
  posts,
  postMetrics,
  accountMetrics,
  reports,
} from "../../src/db/schema";
import {
  generateReport,
  type ReportData,
  type ReportMetrics,
} from "../../src/lib/ai/report";
import { resolveAIProvider } from "../../src/lib/ai/provider";
import { formatDateToYMD } from "../../src/lib/date-utils";

/**
 * Handles the generate_report queue message.
 *
 * 1. Fetches the report record and account info
 * 2. Collects current and previous period metrics
 * 3. Calls the AI API to generate the report
 * 4. Updates the report record to "completed"
 * 5. On error, updates the report record to "failed"
 */
export async function handleGenerateReport(
  message: GenerateReportMessage,
  env: Env,
): Promise<void> {
  const db = createWorkerDb(env.DB);
  const { reportId, accountId } = message;

  try {
    // Fetch the report record
    const reportRows = await db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    if (reportRows.length === 0) {
      console.error(`Report ${reportId} not found, skipping`);
      return;
    }

    const report = reportRows[0]!;

    if (report.status !== "generating") {
      console.log(`Report ${reportId} is not in generating status (${report.status}), skipping`);
      return;
    }

    // Fetch the account
    const accountRows = await db
      .select()
      .from(threadsAccounts)
      .where(eq(threadsAccounts.id, accountId))
      .limit(1);

    if (accountRows.length === 0) {
      throw new Error(`Account ${accountId} not found`);
    }

    const account = accountRows[0]!;

    // Resolve AI provider from env
    const aiConfig = resolveAIProvider(env);

    // Calculate period from report record
    const type = report.type as "weekly" | "monthly";
    const days = type === "weekly" ? 7 : 30;
    const now = new Date();
    const periodEnd = new Date(now);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - days);
    const previousStart = new Date(periodStart);
    previousStart.setDate(previousStart.getDate() - days);

    const periodStartStr = formatDateToYMD(periodStart);
    const periodEndStr = formatDateToYMD(periodEnd);
    const previousStartStr = formatDateToYMD(previousStart);

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

    // Generate the report via AI
    const generatedReport = await generateReport(aiConfig, reportData);

    // Update the report record to completed
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

    console.log(`Report ${reportId} generated successfully`);
  } catch (error) {
    // Update report with failed status
    console.error(`Report generation failed for ${reportId}:`, error);
    try {
      await db
        .update(reports)
        .set({
          status: "failed",
          summary: "レポート生成に失敗しました",
        })
        .where(eq(reports.id, reportId));
    } catch (updateError) {
      console.error(`Failed to update report ${reportId} status to failed:`, updateError);
    }

    throw error;
  }
}
