import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { postMetrics, posts, threadsAccounts } from "@/db/schema";

export interface ListUserPostsOptions {
  userId: string;
  status?: string | null;
  accountId?: string | null;
  limit?: number;
  offset?: number;
}

export async function listUserPosts(
  db: Database,
  {
    userId,
    status,
    accountId,
    limit = 20,
    offset = 0,
  }: ListUserPostsOptions,
) {
  const userAccounts = await db
    .select({ id: threadsAccounts.id })
    .from(threadsAccounts)
    .where(eq(threadsAccounts.userId, userId));

  const accountIds = userAccounts.map((account) => account.id);
  if (accountIds.length === 0) {
    return { posts: [], total: 0 };
  }

  const targetAccountIds = accountId
    ? accountIds.filter((id) => id === accountId)
    : accountIds;

  if (targetAccountIds.length === 0) {
    return { posts: [], total: 0 };
  }

  const conditions = [
    sql`${posts.accountId} IN (${sql.join(
      targetAccountIds.map((id) => sql`${id}`),
      sql`, `,
    )})`,
  ];

  if (status && status !== "all") {
    conditions.push(
      eq(posts.status, status as (typeof posts.status.enumValues)[number]),
    );
  }

  const whereClause = and(...conditions);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(whereClause);

  const total = countResult[0]?.count ?? 0;

  const postRows = await db
    .select({
      id: posts.id,
      accountId: posts.accountId,
      threadsMediaId: posts.threadsMediaId,
      content: posts.content,
      mediaType: posts.mediaType,
      mediaUrls: posts.mediaUrls,
      topicTag: posts.topicTag,
      replyControl: posts.replyControl,
      status: posts.status,
      scheduledAt: posts.scheduledAt,
      publishedAt: posts.publishedAt,
      errorMessage: posts.errorMessage,
      permalink: posts.permalink,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      accountUsername: threadsAccounts.username,
      accountDisplayName: threadsAccounts.displayName,
      accountProfilePicture: threadsAccounts.profilePictureUrl,
    })
    .from(posts)
    .innerJoin(threadsAccounts, eq(posts.accountId, threadsAccounts.id))
    .where(whereClause)
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);

  const publishedPostIds = postRows
    .filter((post) => post.status === "published" && post.threadsMediaId)
    .map((post) => post.id);

  const metricsMap: Record<
    string,
    {
      views: number;
      likes: number;
      replies: number;
      reposts: number;
      quotes: number;
      shares: number;
    }
  > = {};

  if (publishedPostIds.length > 0) {
    const metricsRows = await db
      .select()
      .from(postMetrics)
      .where(
        sql`${postMetrics.postId} IN (${sql.join(
          publishedPostIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
      .orderBy(desc(postMetrics.fetchedAt));

    for (const metric of metricsRows) {
      if (!metricsMap[metric.postId]) {
        metricsMap[metric.postId] = {
          views: metric.views,
          likes: metric.likes,
          replies: metric.replies,
          reposts: metric.reposts,
          quotes: metric.quotes,
          shares: metric.shares,
        };
      }
    }
  }

  return {
    posts: postRows.map((post) => ({
      ...post,
      scheduledAt: post.scheduledAt ? post.scheduledAt.toISOString() : null,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      metrics: metricsMap[post.id] ?? null,
    })),
    total,
  };
}
