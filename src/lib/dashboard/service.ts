import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { accountMetrics, postMetrics, posts, threadsAccounts } from "@/db/schema";

export interface DashboardAccount {
  id: string;
  username: string;
  displayName: string | null;
  profilePictureUrl: string | null;
}

interface DashboardKpiMetric {
  current: number;
  previous: number;
  change: number;
}

export interface DashboardData {
  accounts: DashboardAccount[];
  kpi: {
    views: DashboardKpiMetric;
    likes: DashboardKpiMetric;
    replies: DashboardKpiMetric;
    followers: { current: number; change: number };
  };
  recentPosts: Array<{
    id: string;
    content: string;
    status: string;
    mediaType: string;
    publishedAt: string | null;
    createdAt: string;
    metrics: { views: number; likes: number; replies: number } | null;
  }>;
  dailyMetrics: Array<{
    date: string;
    views: number;
    likes: number;
    replies: number;
    reposts: number;
  }>;
  postsByStatus: {
    published: number;
    scheduled: number;
    draft: number;
    failed: number;
  };
}

export type DashboardDataResult =
  | { status: "ok"; data: DashboardData }
  | { status: "account_not_found" };

export function getDashboardPeriodDays(period: string): number {
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

function createEmptyDashboardData(accounts: DashboardAccount[] = []): DashboardData {
  return {
    accounts,
    kpi: {
      views: { current: 0, previous: 0, change: 0 },
      likes: { current: 0, previous: 0, change: 0 },
      replies: { current: 0, previous: 0, change: 0 },
      followers: { current: 0, change: 0 },
    },
    recentPosts: [],
    dailyMetrics: [],
    postsByStatus: { published: 0, scheduled: 0, draft: 0, failed: 0 },
  };
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getDashboardData(
  db: Database,
  userId: string,
  options: {
    accountId?: string | null;
    period?: string;
  } = {},
): Promise<DashboardDataResult> {
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
    return {
      status: "ok",
      data: createEmptyDashboardData(),
    };
  }

  const targetAccountIds = options.accountId
    ? userAccounts.filter((account) => account.id === options.accountId).map((account) => account.id)
    : userAccounts.map((account) => account.id);

  if (targetAccountIds.length === 0) {
    return { status: "account_not_found" };
  }

  const days = getDashboardPeriodDays(options.period ?? "7d");

  const accountInClause = sql`${accountMetrics.accountId} IN (${sql.join(
    targetAccountIds.map((id) => sql`${id}`),
    sql`, `,
  )})`;

  const postAccountInClause = sql`${posts.accountId} IN (${sql.join(
    targetAccountIds.map((id) => sql`${id}`),
    sql`, `,
  )})`;

  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - days);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - days);

  const currentStartStr = formatDate(currentStart);
  const previousStartStr = formatDate(previousStart);
  const currentEndStr = formatDate(now);
  const previousEndStr = formatDate(currentStart);

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
        lte(accountMetrics.date, currentEndStr),
      ),
    );

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
        lte(accountMetrics.date, previousEndStr),
      ),
    );

  const latestFollowers = await db
    .select({ followersCount: accountMetrics.followersCount })
    .from(accountMetrics)
    .where(accountInClause)
    .orderBy(desc(accountMetrics.date))
    .limit(1);

  const previousFollowers = await db
    .select({ followersCount: accountMetrics.followersCount })
    .from(accountMetrics)
    .where(
      and(
        accountInClause,
        lte(accountMetrics.date, currentStartStr),
      ),
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
    .filter((post) => post.status === "published")
    .map((post) => post.id);

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
          sql`, `,
        )})`,
      )
      .orderBy(desc(postMetrics.fetchedAt));

    for (const metric of metricsRows) {
      if (!postMetricsMap[metric.postId]) {
        postMetricsMap[metric.postId] = {
          views: metric.views,
          likes: metric.likes,
          replies: metric.replies,
        };
      }
    }
  }

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
        lte(accountMetrics.date, currentEndStr),
      ),
    )
    .groupBy(accountMetrics.date)
    .orderBy(accountMetrics.date);

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

  return {
    status: "ok",
    data: {
      accounts: userAccounts,
      kpi: {
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
      },
      recentPosts: recentPostRows.map((post) => ({
        id: post.id,
        content: post.content,
        status: post.status,
        mediaType: post.mediaType,
        publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
        createdAt: post.createdAt.toISOString(),
        metrics: postMetricsMap[post.id] ?? null,
      })),
      dailyMetrics: dailyMetricsRows.map((row) => ({
        date: row.date,
        views: row.views,
        likes: row.likes,
        replies: row.replies,
        reposts: row.reposts,
      })),
      postsByStatus,
    },
  };
}
