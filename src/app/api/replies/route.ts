import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { posts, threadsAccounts, session } from "@/db/schema";
import { eq, and, desc, sql, isNotNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { decryptToken } from "@/lib/threads/encryption";
import { ThreadsClient } from "@/lib/threads/client";
import { ThreadsApiError } from "@/lib/threads/types";

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

interface ReplyData {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  permalink?: string;
  hideStatus: string;
  parentPost: {
    id: string;
    threadsMediaId: string;
    content: string;
  };
}

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
    const postId = searchParams.get("postId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId は必須です" },
        { status: 400 }
      );
    }

    // Verify the account belongs to this user
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

    const account = accountRows[0];
    if (!account) {
      return NextResponse.json(
        { error: "アカウントが見つかりません" },
        { status: 404 }
      );
    }

    const accessToken = await decryptToken(account.accessToken);
    const client = new ThreadsClient(accessToken, account.threadsUserId);

    const allReplies: ReplyData[] = [];
    let rateLimited = false;

    if (postId) {
      // Get replies for a specific post
      const postRow = await db
        .select({
          id: posts.id,
          threadsMediaId: posts.threadsMediaId,
          content: posts.content,
        })
        .from(posts)
        .where(
          and(
            eq(posts.accountId, accountId),
            eq(posts.threadsMediaId, postId)
          )
        )
        .limit(1);

      const parentPost = postRow[0];
      if (!parentPost || !parentPost.threadsMediaId) {
        return NextResponse.json(
          { error: "投稿が見つかりません" },
          { status: 404 }
        );
      }

      try {
        const repliesResponse = await client.getReplies(parentPost.threadsMediaId);
        for (const reply of repliesResponse.data) {
          allReplies.push({
            id: reply.id,
            text: reply.text ?? "",
            username: reply.username ?? "unknown",
            timestamp: reply.timestamp,
            permalink: reply.permalink,
            hideStatus: reply.hide_status ?? "NOT_HUSHED",
            parentPost: {
              id: parentPost.id,
              threadsMediaId: parentPost.threadsMediaId,
              content: parentPost.content,
            },
          });
        }
      } catch (err) {
        if (err instanceof ThreadsApiError && err.isRateLimited) {
          rateLimited = true;
        } else {
          throw err;
        }
      }
    } else {
      // Get all published posts for the account, then fetch replies for each
      const publishedPosts = await db
        .select({
          id: posts.id,
          threadsMediaId: posts.threadsMediaId,
          content: posts.content,
        })
        .from(posts)
        .where(
          and(
            eq(posts.accountId, accountId),
            eq(posts.status, "published"),
            isNotNull(posts.threadsMediaId)
          )
        )
        .orderBy(desc(posts.publishedAt))
        .limit(50);

      for (const post of publishedPosts) {
        if (!post.threadsMediaId) continue;

        try {
          const repliesResponse = await client.getReplies(post.threadsMediaId);
          for (const reply of repliesResponse.data) {
            allReplies.push({
              id: reply.id,
              text: reply.text ?? "",
              username: reply.username ?? "unknown",
              timestamp: reply.timestamp,
              permalink: reply.permalink,
              hideStatus: reply.hide_status ?? "NOT_HUSHED",
              parentPost: {
                id: post.id,
                threadsMediaId: post.threadsMediaId,
                content: post.content,
              },
            });
          }
        } catch (err) {
          if (err instanceof ThreadsApiError && err.isRateLimited) {
            rateLimited = true;
            // Stop fetching more posts when rate limited, return partial results
            break;
          }
          // Skip individual post errors (e.g. post deleted on Threads)
          console.error(`Failed to fetch replies for post ${post.threadsMediaId}:`, err);
        }
      }
    }

    // Sort by timestamp desc
    allReplies.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      replies: allReplies,
      totalCount: allReplies.length,
      rateLimited,
    });
  } catch (error) {
    console.error("GET /api/replies error:", error);
    return NextResponse.json(
      { error: "リプライの取得に失敗しました" },
      { status: 500 }
    );
  }
}
