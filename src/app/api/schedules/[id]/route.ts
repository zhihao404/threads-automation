import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { recurringSchedules, threadsAccounts, postTemplates } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { updateScheduleSchema, toggleScheduleSchema } from "@/lib/validations/schedule";
import { buildCronExpression, isValidCron, getNextRunTime } from "@/lib/cron/parser";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";

/**
 * Verify the schedule belongs to the user and return it.
 */
async function getScheduleForUser(
  scheduleId: string,
  userId: string,
  db: ReturnType<typeof createDb>,
) {
  const rows = await db
    .select({
      id: recurringSchedules.id,
      accountId: recurringSchedules.accountId,
      templateId: recurringSchedules.templateId,
      cronExpression: recurringSchedules.cronExpression,
      timezone: recurringSchedules.timezone,
      isActive: recurringSchedules.isActive,
      lastRunAt: recurringSchedules.lastRunAt,
      nextRunAt: recurringSchedules.nextRunAt,
      createdAt: recurringSchedules.createdAt,
      updatedAt: recurringSchedules.updatedAt,
      accountUsername: threadsAccounts.username,
      accountDisplayName: threadsAccounts.displayName,
      templateName: postTemplates.name,
      templateContent: postTemplates.content,
    })
    .from(recurringSchedules)
    .innerJoin(threadsAccounts, eq(recurringSchedules.accountId, threadsAccounts.id))
    .leftJoin(postTemplates, eq(recurringSchedules.templateId, postTemplates.id))
    .where(
      and(
        eq(recurringSchedules.id, scheduleId),
        eq(threadsAccounts.userId, userId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id } = await context.params;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    const schedule = await getScheduleForUser(id, userId, db);
    if (!schedule) {
      return NextResponse.json(
        { error: "スケジュールが見つかりません" },
        { status: 404 },
      );
    }

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error("GET /api/schedules/[id] error:", error);
    return NextResponse.json(
      { error: "スケジュールの取得に失敗しました" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id } = await context.params;
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

    const existing = await getScheduleForUser(id, userId, db);
    if (!existing) {
      return NextResponse.json(
        { error: "スケジュールが見つかりません" },
        { status: 404 },
      );
    }

    // Validate template if provided
    if (input.templateId) {
      const templateRows = await db
        .select({ id: postTemplates.id })
        .from(postTemplates)
        .where(
          and(
            eq(postTemplates.id, input.templateId),
            eq(postTemplates.userId, userId),
          ),
        )
        .limit(1);

      if (!templateRows[0]) {
        return NextResponse.json(
          { error: "テンプレートが見つかりません" },
          { status: 404 },
        );
      }
    }

    // Determine cron expression
    let cronExpression = existing.cronExpression;
    if (input.cronExpression) {
      cronExpression = input.cronExpression;
    } else if (input.schedule) {
      cronExpression = buildCronExpression(input.schedule);
    }

    if (!isValidCron(cronExpression)) {
      return NextResponse.json(
        { error: "無効なCron式です" },
        { status: 400 },
      );
    }

    const timezone = input.timezone ?? existing.timezone;
    const isActive = input.isActive ?? existing.isActive;
    const now = new Date();

    const nextRunAt = isActive
      ? getNextRunTime(cronExpression, timezone, now)
      : null;

    const updateValues: Record<string, unknown> = {
      cronExpression,
      timezone,
      isActive,
      nextRunAt,
      updatedAt: now,
    };

    if (input.templateId !== undefined) {
      updateValues.templateId = input.templateId;
    }

    await db
      .update(recurringSchedules)
      .set(updateValues)
      .where(eq(recurringSchedules.id, id));

    return NextResponse.json({ id, cronExpression, nextRunAt, isActive });
  } catch (error) {
    console.error("PUT /api/schedules/[id] error:", error);
    return NextResponse.json(
      { error: "スケジュールの更新に失敗しました" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const parseResult = toggleScheduleSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "入力内容に誤りがあります" },
        { status: 400 },
      );
    }

    const { isActive } = parseResult.data;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    const existing = await getScheduleForUser(id, userId, db);
    if (!existing) {
      return NextResponse.json(
        { error: "スケジュールが見つかりません" },
        { status: 404 },
      );
    }

    const now = new Date();
    const nextRunAt = isActive
      ? getNextRunTime(existing.cronExpression, existing.timezone, now)
      : null;

    await db
      .update(recurringSchedules)
      .set({
        isActive,
        nextRunAt,
        updatedAt: now,
      })
      .where(eq(recurringSchedules.id, id));

    return NextResponse.json({ id, isActive, nextRunAt });
  } catch (error) {
    console.error("PATCH /api/schedules/[id] error:", error);
    return NextResponse.json(
      { error: "スケジュールの更新に失敗しました" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id } = await context.params;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    const existing = await getScheduleForUser(id, userId, db);
    if (!existing) {
      return NextResponse.json(
        { error: "スケジュールが見つかりません" },
        { status: 404 },
      );
    }

    await db
      .delete(recurringSchedules)
      .where(eq(recurringSchedules.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/schedules/[id] error:", error);
    return NextResponse.json(
      { error: "スケジュールの削除に失敗しました" },
      { status: 500 },
    );
  }
}
