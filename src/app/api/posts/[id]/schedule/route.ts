// =============================================================================
// PATCH /api/posts/[id]/schedule
// Update a scheduled post's time, or cancel scheduling (revert to draft)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { posts, threadsAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";

const updateScheduleSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    scheduledAt: z.string().min(1, "予約日時を指定してください"),
  }),
  z.object({
    action: z.literal("cancel"),
  }),
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parseResult = updateScheduleSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "入力内容に誤りがあります", details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    const input = parseResult.data;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Get the post and verify ownership
    const postRows = await db
      .select({
        id: posts.id,
        status: posts.status,
        accountId: posts.accountId,
        accountUserId: threadsAccounts.userId,
      })
      .from(posts)
      .innerJoin(threadsAccounts, eq(posts.accountId, threadsAccounts.id))
      .where(eq(posts.id, id))
      .limit(1);

    const post = postRows[0];
    if (!post) {
      return NextResponse.json(
        { error: "投稿が見つかりません" },
        { status: 404 },
      );
    }

    if (post.accountUserId !== userId) {
      return NextResponse.json(
        { error: "アクセス権がありません" },
        { status: 403 },
      );
    }

    const now = new Date();

    if (input.action === "cancel") {
      // Can only cancel scheduled or queued posts
      if (post.status !== "scheduled" && post.status !== "queued") {
        return NextResponse.json(
          { error: "この投稿のスケジュールはキャンセルできません" },
          { status: 400 },
        );
      }

      await db
        .update(posts)
        .set({
          status: "draft",
          scheduledAt: null,
          updatedAt: now,
        })
        .where(eq(posts.id, id));

      return NextResponse.json({ id, status: "draft" });
    }

    // action === "update"
    // Can only update draft or scheduled posts
    if (post.status !== "draft" && post.status !== "scheduled") {
      return NextResponse.json(
        { error: "この投稿のスケジュールは変更できません" },
        { status: 400 },
      );
    }

    const scheduledAt = new Date(input.scheduledAt);

    // Validate that the scheduled time is in the future
    if (scheduledAt <= now) {
      return NextResponse.json(
        { error: "予約日時は現在より後の日時を指定してください" },
        { status: 400 },
      );
    }

    await db
      .update(posts)
      .set({
        status: "scheduled",
        scheduledAt,
        updatedAt: now,
      })
      .where(eq(posts.id, id));

    return NextResponse.json({
      id,
      status: "scheduled",
      scheduledAt: scheduledAt.toISOString(),
    });
  } catch (error) {
    console.error("PATCH /api/posts/[id]/schedule error:", error);
    return NextResponse.json(
      { error: "スケジュールの更新に失敗しました" },
      { status: 500 },
    );
  }
}
