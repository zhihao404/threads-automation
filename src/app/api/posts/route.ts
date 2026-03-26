import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { posts, postMetrics, threadsAccounts } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { createPostSchema } from "@/lib/validations/post";
import { guardPlanLimit } from "@/lib/plans/guard";
import { incrementUsage } from "@/lib/plans/limits";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";

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
    const status = searchParams.get("status");
    const accountId = searchParams.get("accountId");
    const parsedLimit = parseInt(searchParams.get("limit") || "20");
    const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 20 : Math.min(parsedLimit, 100);
    const parsedOffset = parseInt(searchParams.get("offset") || "0");
    const offset = isNaN(parsedOffset) || parsedOffset < 0 ? 0 : Math.min(parsedOffset, 10000);

    // Build conditions: only show posts for accounts owned by this user
    const userAccounts = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(eq(threadsAccounts.userId, userId));

    const accountIds = userAccounts.map((a) => a.id);
    if (accountIds.length === 0) {
      return NextResponse.json({ posts: [], total: 0 });
    }

    const conditions = [
      sql`${posts.accountId} IN (${sql.join(
        accountIds.map((id) => sql`${id}`),
        sql`, `
      )})`,
    ];

    if (status && status !== "all") {
      conditions.push(eq(posts.status, status as typeof posts.status.enumValues[number]));
    }

    if (accountId) {
      conditions.push(eq(posts.accountId, accountId));
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(whereClause);

    const total = countResult[0]?.count ?? 0;

    // Get posts with account info
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

    // Get metrics for published posts
    const publishedPostIds = postRows
      .filter((p) => p.status === "published" && p.threadsMediaId)
      .map((p) => p.id);

    let metricsMap: Record<
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

      // Use the latest metrics for each post
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
      metrics: metricsMap[p.id] || null,
    }));

    return NextResponse.json({ posts: postsWithMetrics, total });
  } catch (error) {
    console.error("GET /api/posts error:", error);
    return NextResponse.json(
      { error: "投稿の取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parseResult = createPostSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "入力内容に誤りがあります", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Check plan limit for post creation
    const postLimitResponse = await guardPlanLimit(db, userId, "post");
    if (postLimitResponse) return postLimitResponse;

    // If scheduling, also check the scheduled posts limit
    if (input.status === "scheduled") {
      const scheduleLimitResponse = await guardPlanLimit(db, userId, "schedule");
      if (scheduleLimitResponse) return scheduleLimitResponse;
    }

    // Verify the account belongs to this user
    const accountRows = await db
      .select()
      .from(threadsAccounts)
      .where(
        and(
          eq(threadsAccounts.id, input.accountId),
          eq(threadsAccounts.userId, userId)
        )
      )
      .limit(1);

    const account = accountRows[0];
    if (!account) {
      return NextResponse.json(
        { error: "アカウントが見つかりません" },
        { status: 404 }
      );
    }

    const now = new Date();
    const postId = ulid();

    if (input.status === "publish") {
      // Publish immediately via Threads API
      try {
        const { decryptToken } = await import("@/lib/threads/encryption");
        const { ThreadsClient } = await import("@/lib/threads/client");

        const accessToken = await decryptToken(account.accessToken);
        const client = new ThreadsClient(accessToken);

        let publishedMediaId: string;

        if (input.mediaType === "TEXT") {
          publishedMediaId = await client.createTextPost({
            text: input.content,
            replyControl: input.replyControl,
            topicTag: input.topicTag,
          });
        } else if (input.mediaType === "IMAGE" && input.mediaUrls?.[0]) {
          publishedMediaId = await client.createImagePost({
            text: input.content,
            imageUrl: input.mediaUrls[0],
            replyControl: input.replyControl,
            topicTag: input.topicTag,
          });
        } else if (input.mediaType === "VIDEO" && input.mediaUrls?.[0]) {
          publishedMediaId = await client.createVideoPost({
            text: input.content,
            videoUrl: input.mediaUrls[0],
            replyControl: input.replyControl,
            topicTag: input.topicTag,
          });
        } else if (input.mediaType === "CAROUSEL" && input.mediaUrls?.length) {
          publishedMediaId = await client.createCarouselPost({
            text: input.content,
            children: input.mediaUrls.map((url) => ({
              mediaType: "IMAGE" as const,
              url,
            })),
            replyControl: input.replyControl,
            topicTag: input.topicTag,
          });
        } else {
          return NextResponse.json(
            { error: "メディアタイプに対応するURLが必要です" },
            { status: 400 }
          );
        }

        // Get the post permalink
        let permalink: string | undefined;
        try {
          const threadPost = await client.getPost(publishedMediaId);
          permalink = threadPost.permalink;
        } catch {
          // Permalink fetch is non-critical
        }

        await db.insert(posts).values({
          id: postId,
          accountId: input.accountId,
          threadsMediaId: publishedMediaId,
          content: input.content,
          mediaType: input.mediaType,
          mediaUrls: input.mediaUrls ? JSON.stringify(input.mediaUrls) : null,
          topicTag: input.topicTag || null,
          replyControl: input.replyControl,
          status: "published",
          publishedAt: now,
          permalink: permalink || null,
          createdAt: now,
          updatedAt: now,
        });

        await incrementUsage(db, userId, "post");

        return NextResponse.json(
          { id: postId, status: "published", threadsMediaId: publishedMediaId },
          { status: 201 }
        );
      } catch (publishError: unknown) {
        // Save as failed if publish fails
        const errorMessage =
          publishError instanceof Error
            ? publishError.message
            : "投稿の公開に失敗しました";

        await db.insert(posts).values({
          id: postId,
          accountId: input.accountId,
          content: input.content,
          mediaType: input.mediaType,
          mediaUrls: input.mediaUrls ? JSON.stringify(input.mediaUrls) : null,
          topicTag: input.topicTag || null,
          replyControl: input.replyControl,
          status: "failed",
          errorMessage,
          createdAt: now,
          updatedAt: now,
        });

        return NextResponse.json(
          { id: postId, status: "failed", error: errorMessage },
          { status: 502 }
        );
      }
    } else if (input.status === "scheduled") {
      if (!input.scheduledAt) {
        return NextResponse.json(
          { error: "予約投稿には日時の指定が必要です" },
          { status: 400 }
        );
      }

      await db.insert(posts).values({
        id: postId,
        accountId: input.accountId,
        content: input.content,
        mediaType: input.mediaType,
        mediaUrls: input.mediaUrls ? JSON.stringify(input.mediaUrls) : null,
        topicTag: input.topicTag || null,
        replyControl: input.replyControl,
        status: "scheduled",
        scheduledAt: new Date(input.scheduledAt),
        createdAt: now,
        updatedAt: now,
      });

      await incrementUsage(db, userId, "post");

      return NextResponse.json(
        { id: postId, status: "scheduled" },
        { status: 201 }
      );
    } else {
      // draft
      await db.insert(posts).values({
        id: postId,
        accountId: input.accountId,
        content: input.content,
        mediaType: input.mediaType,
        mediaUrls: input.mediaUrls ? JSON.stringify(input.mediaUrls) : null,
        topicTag: input.topicTag || null,
        replyControl: input.replyControl,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });

      await incrementUsage(db, userId, "post");

      return NextResponse.json(
        { id: postId, status: "draft" },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("POST /api/posts error:", error);
    return NextResponse.json(
      { error: "投稿の作成に失敗しました" },
      { status: 500 }
    );
  }
}
