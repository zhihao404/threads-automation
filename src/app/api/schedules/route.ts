import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { recurringSchedules, threadsAccounts, postTemplates, session } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { createScheduleSchema } from "@/lib/validations/schedule";
import { buildCronExpression, isValidCron, getNextRunTime } from "@/lib/cron/parser";
import { cookies } from "next/headers";

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
        sql`${session.expiresAt} > ${Math.floor(Date.now() / 1000)}`,
      ),
    )
    .limit(1);

  return sessions[0]?.userId ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    // Get accounts owned by this user
    const userAccounts = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(eq(threadsAccounts.userId, userId));

    const accountIds = userAccounts.map((a) => a.id);
    if (accountIds.length === 0) {
      return NextResponse.json({ schedules: [], total: 0 });
    }

    const conditions = [
      sql`${recurringSchedules.accountId} IN (${sql.join(
        accountIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    ];

    if (accountId) {
      conditions.push(eq(recurringSchedules.accountId, accountId));
    }

    const whereClause = and(...conditions);

    const scheduleRows = await db
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
      .where(whereClause)
      .orderBy(desc(recurringSchedules.createdAt));

    const total = scheduleRows.length;

    return NextResponse.json({ schedules: scheduleRows, total });
  } catch (error) {
    console.error("GET /api/schedules error:", error);
    return NextResponse.json(
      { error: "スケジュールの取得に失敗しました" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parseResult = createScheduleSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "入力内容に誤りがあります", details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    const input = parseResult.data;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Verify the account belongs to this user
    const accountRows = await db
      .select()
      .from(threadsAccounts)
      .where(
        and(
          eq(threadsAccounts.id, input.accountId),
          eq(threadsAccounts.userId, userId),
        ),
      )
      .limit(1);

    if (!accountRows[0]) {
      return NextResponse.json(
        { error: "アカウントが見つかりません" },
        { status: 404 },
      );
    }

    // Verify template if provided
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
    let cronExpression: string;
    if (input.cronExpression) {
      cronExpression = input.cronExpression;
    } else if (input.schedule) {
      cronExpression = buildCronExpression(input.schedule);
    } else {
      return NextResponse.json(
        { error: "スケジュールを設定してください" },
        { status: 400 },
      );
    }

    if (!isValidCron(cronExpression)) {
      return NextResponse.json(
        { error: "無効なCron式です" },
        { status: 400 },
      );
    }

    const timezone = input.timezone || "Asia/Tokyo";
    const now = new Date();
    const nextRunAt = getNextRunTime(cronExpression, timezone, now);

    const scheduleId = ulid();
    await db.insert(recurringSchedules).values({
      id: scheduleId,
      accountId: input.accountId,
      templateId: input.templateId || null,
      cronExpression,
      timezone,
      isActive: true,
      nextRunAt,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      { id: scheduleId, cronExpression, nextRunAt },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/schedules error:", error);
    return NextResponse.json(
      { error: "スケジュールの作成に失敗しました" },
      { status: 500 },
    );
  }
}
