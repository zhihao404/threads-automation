import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { posts, threadsAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ulid } from "ulid";
import { createPostSchema } from "@/lib/validations/post";
import { guardPlanLimit } from "@/lib/plans/guard";
import { incrementUsage } from "@/lib/plans/limits";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { apiError } from "@/lib/api-response";
import { listUserPosts } from "@/lib/posts/service";
import {
  canPublish,
  recordPublish,
  recordApiCall,
  predictQuotaExhaustion,
} from "@/lib/threads/rate-gate";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return apiError("認証が必要です", 401);
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

    const result = await listUserPosts(db, {
      userId,
      status,
      accountId,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/posts error:", error);
    return apiError("投稿の取得に失敗しました", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return apiError("認証が必要です", 401);
    }

    const body = await request.json();
    const parseResult = createPostSchema.safeParse(body);

    if (!parseResult.success) {
      return apiError("入力内容に誤りがあります", 400);
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
      return apiError("アカウントが見つかりません", 404);
    }

    const now = new Date();
    const postId = ulid();

    if (input.status === "publish") {
      // Check Threads profile-level post rate limit before publishing
      const quota = await canPublish(db, input.accountId);

      if (!quota.allowed) {
        return apiError(
          `投稿の24時間上限（${quota.limit}件）に達しました。${quota.windowResetsAt ? `リセット: ${new Date(quota.windowResetsAt * 1000).toISOString()}` : ""}`,
          429,
        );
      }

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
          return apiError("メディアタイプに対応するURLが必要です", 400);
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

        // Record Threads profile-level usage for rate gate tracking
        await recordPublish(db, input.accountId);
        // Each publish flow makes multiple API calls (create container + publish + optional getPost)
        await recordApiCall(db, input.accountId);

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

        return apiError(errorMessage, 502);
      }
    } else if (input.status === "scheduled") {
      if (!input.scheduledAt) {
        return apiError("予約投稿には日時の指定が必要です", 400);
      }

      // Predict whether this scheduled post will push the profile over its post limit
      const prediction = await predictQuotaExhaustion(db, input.accountId, 1, "post");

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
        {
          id: postId,
          status: "scheduled",
          ...(prediction.willExceed && {
            warning: `この予約投稿を含めると24時間の投稿上限（${prediction.limit}件）を超過する可能性があります。現在の使用量: ${prediction.currentUsage}件`,
          }),
        },
        { status: 201 },
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

      return NextResponse.json(
        { id: postId, status: "draft" },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("POST /api/posts error:", error);
    return apiError("投稿の作成に失敗しました", 500);
  }
}
