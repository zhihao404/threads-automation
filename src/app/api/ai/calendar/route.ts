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
} from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  generateContentCalendar,
  type CalendarParams,
} from "@/lib/ai/calendar";
import type { AccountOverview, PostPerformanceData } from "@/lib/ai/insights";

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
    const {
      accountId,
      period = "week",
      postsPerDay = 1,
      topics,
      tone,
    } = body as {
      accountId?: string;
      period?: "week" | "2weeks" | "month";
      postsPerDay?: number;
      topics?: string[];
      tone?: string;
    };

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    if (!env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI機能が設定されていません。管理者にお問い合わせください。" },
        { status: 503 }
      );
    }

    // Build account data if accountId provided
    let accountData: AccountOverview | undefined;

    if (accountId) {
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

      // Fetch recent post data for personalization
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - 30);

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
            sql`${posts.publishedAt} >= ${Math.floor(periodStart.getTime() / 1000)}`
          )
        )
        .orderBy(desc(posts.publishedAt));

      const postIds = publishedPosts.map((p) => p.id);
      const metricsMap: Record<
        string,
        { views: number; likes: number; replies: number; reposts: number; quotes: number }
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

      const accountMetricsRows = await db
        .select()
        .from(accountMetrics)
        .where(eq(accountMetrics.accountId, accountId))
        .orderBy(desc(accountMetrics.date))
        .limit(30);

      const latestFollowers = accountMetricsRows[0]?.followersCount ?? 0;
      const earliestFollowers =
        accountMetricsRows[accountMetricsRows.length - 1]?.followersCount ?? 0;

      const postsWithMetrics: PostPerformanceData[] = publishedPosts.map(
        (p) => ({
          content: p.content,
          mediaType: p.mediaType,
          publishedAt: p.publishedAt
            ? new Date(p.publishedAt).toISOString()
            : "",
          metrics: metricsMap[p.id] || {
            views: 0,
            likes: 0,
            replies: 0,
            reposts: 0,
            quotes: 0,
          },
        })
      );

      const totalViews = postsWithMetrics.reduce(
        (sum, p) => sum + p.metrics.views,
        0
      );
      const totalLikes = postsWithMetrics.reduce(
        (sum, p) => sum + p.metrics.likes,
        0
      );
      const totalReplies = postsWithMetrics.reduce(
        (sum, p) => sum + p.metrics.replies,
        0
      );
      const postCount = postsWithMetrics.length || 1;

      const postsByHour: Record<number, number> = {};
      const postsByDay: Record<number, number> = {};

      for (const p of postsWithMetrics) {
        if (p.publishedAt) {
          const date = new Date(p.publishedAt);
          const hour = date.getHours();
          const day = date.getDay();
          postsByHour[hour] = (postsByHour[hour] || 0) + 1;
          postsByDay[day] = (postsByDay[day] || 0) + 1;
        }
      }

      const topPostsByEngagement = [...postsWithMetrics]
        .sort(
          (a, b) =>
            b.metrics.likes +
            b.metrics.replies +
            b.metrics.reposts -
            (a.metrics.likes + a.metrics.replies + a.metrics.reposts)
        )
        .slice(0, 5);

      accountData = {
        totalPosts: postsWithMetrics.length,
        avgViews: Math.round(totalViews / postCount),
        avgLikes: Math.round(totalLikes / postCount),
        avgReplies: Math.round(totalReplies / postCount),
        followersCount: latestFollowers,
        followersTrend: latestFollowers - earliestFollowers,
        topPostsByViews: [...postsWithMetrics]
          .sort((a, b) => b.metrics.views - a.metrics.views)
          .slice(0, 5),
        topPostsByEngagement,
        postsByHour,
        postsByDay,
      };
    }

    const calendarParams: CalendarParams = {
      period,
      postsPerDay: Math.min(postsPerDay, 3),
      topics,
      tone,
      accountData,
    };

    const suggestions = await generateContentCalendar(
      env.ANTHROPIC_API_KEY,
      calendarParams
    );

    return NextResponse.json({ suggestions });
  } catch (error: unknown) {
    console.error("POST /api/ai/calendar error:", error);

    if (error && typeof error === "object" && "status" in error) {
      const apiError = error as { status: number };
      if (apiError.status === 429) {
        return NextResponse.json(
          { error: "リクエストが多すぎます。しばらく待ってからお試しください。" },
          { status: 429 }
        );
      }
      if (apiError.status === 401) {
        return NextResponse.json(
          { error: "AIサービスの認証に失敗しました。APIキーを確認してください。" },
          { status: 500 }
        );
      }
    }

    const message =
      error instanceof Error
        ? error.message
        : "カレンダーの生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
