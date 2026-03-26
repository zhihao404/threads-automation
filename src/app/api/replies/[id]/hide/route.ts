import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { threadsAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptToken } from "@/lib/threads/encryption";
import { ThreadsClient } from "@/lib/threads/client";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { id: replyId } = await params;
    const body = await request.json();
    const { hide, accountId } = body as { hide: boolean; accountId: string };

    if (typeof hide !== "boolean" || !accountId) {
      return NextResponse.json(
        { error: "hide (boolean) と accountId は必須です" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

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

    await client.hideReply(replyId, hide);

    return NextResponse.json({
      success: true,
      replyId,
      hide,
    });
  } catch (error) {
    console.error("POST /api/replies/[id]/hide error:", error);
    return NextResponse.json(
      { error: "リプライの表示/非表示の切り替えに失敗しました" },
      { status: 500 }
    );
  }
}
