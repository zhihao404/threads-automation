import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { threadsAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";

export interface QueueSettings {
  intervalMinutes: number;
  isPaused: boolean;
  nextPublishAt: string | null;
}

/**
 * GET /api/queue/settings?accountId=xxx
 * Returns queue settings for an account from KV.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountIdが必要です" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Verify the account belongs to this user
    const accountRows = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(
        and(
          eq(threadsAccounts.id, accountId),
          eq(threadsAccounts.userId, userId)
        )
      )
      .limit(1);

    if (!accountRows[0]) {
      return NextResponse.json(
        { error: "アカウントが見つかりません" },
        { status: 404 }
      );
    }

    const settingsKey = `queue:settings:${accountId}`;
    const settingsRaw = await env.CACHE.get(settingsKey);
    const settings: QueueSettings = settingsRaw
      ? (JSON.parse(settingsRaw) as QueueSettings)
      : {
          intervalMinutes: 60,
          isPaused: false,
          nextPublishAt: null,
        };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("GET /api/queue/settings error:", error);
    return NextResponse.json(
      { error: "キュー設定の取得に失敗しました" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/queue/settings
 * Update queue settings in KV.
 * Body: { accountId: string, intervalMinutes: number, isPaused: boolean }
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      accountId?: string;
      intervalMinutes?: number;
      isPaused?: boolean;
    };

    const { accountId, intervalMinutes, isPaused } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "accountIdが必要です" },
        { status: 400 }
      );
    }

    if (typeof intervalMinutes !== "number" || intervalMinutes < 15) {
      return NextResponse.json(
        { error: "intervalMinutesは15以上の数値が必要です" },
        { status: 400 }
      );
    }

    if (typeof isPaused !== "boolean") {
      return NextResponse.json(
        { error: "isPausedはboolean値が必要です" },
        { status: 400 }
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Verify the account belongs to this user
    const accountRows = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(
        and(
          eq(threadsAccounts.id, accountId),
          eq(threadsAccounts.userId, userId)
        )
      )
      .limit(1);

    if (!accountRows[0]) {
      return NextResponse.json(
        { error: "アカウントが見つかりません" },
        { status: 404 }
      );
    }

    // Get existing settings to preserve nextPublishAt if not pausing
    const settingsKey = `queue:settings:${accountId}`;
    const existingRaw = await env.CACHE.get(settingsKey);
    const existing = existingRaw
      ? (JSON.parse(existingRaw) as QueueSettings)
      : null;

    const settings: QueueSettings = {
      intervalMinutes,
      isPaused,
      nextPublishAt: isPaused ? null : (existing?.nextPublishAt ?? null),
    };

    await env.CACHE.put(settingsKey, JSON.stringify(settings));

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("PUT /api/queue/settings error:", error);
    return NextResponse.json(
      { error: "キュー設定の更新に失敗しました" },
      { status: 500 }
    );
  }
}
