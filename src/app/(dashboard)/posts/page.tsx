import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { posts, postMetrics, threadsAccounts } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { PostsClient } from "@/components/posts/posts-client";

export default async function PostsPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  // Get user's accounts
  const userAccounts = await db
    .select({ id: threadsAccounts.id })
    .from(threadsAccounts)
    .where(eq(threadsAccounts.userId, userId));

  const accountIds = userAccounts.map((a) => a.id);

  if (accountIds.length === 0) {
    return <PostsClient initialPosts={[]} initialTotal={0} />;
  }

  const accountInClause = sql`${posts.accountId} IN (${sql.join(
    accountIds.map((id) => sql`${id}`),
    sql`, `
  )})`;

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(accountInClause);

  const total = countResult[0]?.count ?? 0;

  // Get posts with account info (initial load: all, limit 50)
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
    .where(accountInClause)
    .orderBy(desc(posts.createdAt))
    .limit(50);

  // Get metrics for published posts
  const publishedPostIds = postRows
    .filter((p) => p.status === "published" && p.threadsMediaId)
    .map((p) => p.id);

  const metricsMap: Record<
    string,
    { views: number; likes: number; replies: number; reposts: number; quotes: number; shares: number }
  > = {};

  if (publishedPostIds.length > 0) {
    const metricsRows = await db
      .select()
      .from(postMetrics)
      .where(
        sql`${postMetrics.postId} IN (${sql.join(
          publishedPostIds.map((id) => sql`${id}`),
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

  const postsWithMetrics = postRows.map((p) => ({
    ...p,
    scheduledAt: p.scheduledAt ? p.scheduledAt.toISOString() : null,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    metrics: metricsMap[p.id] || null,
  }));

  return <PostsClient initialPosts={postsWithMetrics} initialTotal={total} />;
}
