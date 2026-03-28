import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { posts, postMetrics, threadsAccounts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { apiError } from "@/lib/api-response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return apiError("認証が必要です", 401);
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Get post with account info, verify ownership
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
        retryCount: posts.retryCount,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        accountUsername: threadsAccounts.username,
        accountDisplayName: threadsAccounts.displayName,
        accountProfilePicture: threadsAccounts.profilePictureUrl,
        accountUserId: threadsAccounts.userId,
      })
      .from(posts)
      .innerJoin(threadsAccounts, eq(posts.accountId, threadsAccounts.id))
      .where(eq(posts.id, id))
      .limit(1);

    const post = postRows[0];
    if (!post) {
      return apiError("投稿が見つかりません", 404);
    }

    if (post.accountUserId !== userId) {
      return apiError("アクセス権がありません", 403);
    }

    // Get metrics if published
    let metrics = null;
    if (post.status === "published") {
      const metricsRows = await db
        .select()
        .from(postMetrics)
        .where(eq(postMetrics.postId, id))
        .orderBy(desc(postMetrics.fetchedAt))
        .limit(1);

      if (metricsRows[0]) {
        metrics = {
          views: metricsRows[0].views,
          likes: metricsRows[0].likes,
          replies: metricsRows[0].replies,
          reposts: metricsRows[0].reposts,
          quotes: metricsRows[0].quotes,
          shares: metricsRows[0].shares,
          fetchedAt: metricsRows[0].fetchedAt,
        };
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { accountUserId: _accountUserId, ...postData } = post;

    return NextResponse.json({ post: { ...postData, metrics } });
  } catch (error) {
    console.error("GET /api/posts/[id] error:", error);
    return apiError("投稿の取得に失敗しました", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return apiError("認証が必要です", 401);
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Get post with account info, verify ownership
    const postRows = await db
      .select({
        id: posts.id,
        threadsMediaId: posts.threadsMediaId,
        status: posts.status,
        accountId: posts.accountId,
        accountUserId: threadsAccounts.userId,
        accessToken: threadsAccounts.accessToken,
        threadsUserId: threadsAccounts.threadsUserId,
      })
      .from(posts)
      .innerJoin(threadsAccounts, eq(posts.accountId, threadsAccounts.id))
      .where(eq(posts.id, id))
      .limit(1);

    const post = postRows[0];
    if (!post) {
      return apiError("投稿が見つかりません", 404);
    }

    if (post.accountUserId !== userId) {
      return apiError("アクセス権がありません", 403);
    }

    // If published, try to delete from Threads
    if (post.status === "published" && post.threadsMediaId) {
      try {
        const { decryptToken } = await import("@/lib/threads/encryption");
        const { ThreadsClient } = await import("@/lib/threads/client");

        const accessToken = await decryptToken(post.accessToken);
        const client = new ThreadsClient(accessToken);
        await client.deletePost(post.threadsMediaId);
      } catch (deleteError) {
        console.error("Failed to delete post from Threads:", deleteError);
        // Continue with local deletion even if remote deletion fails
      }
    }

    // Delete metrics first (cascade should handle this, but be explicit)
    await db.delete(postMetrics).where(eq(postMetrics.postId, id));

    // Delete the post
    await db.delete(posts).where(eq(posts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/posts/[id] error:", error);
    return apiError("投稿の削除に失敗しました", 500);
  }
}
