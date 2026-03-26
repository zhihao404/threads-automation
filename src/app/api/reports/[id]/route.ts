import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { createDb } from "@/db";
import { session, threadsAccounts, reports } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

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

// GET /api/reports/[id] - Get full report with HTML content
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Get the report
    const reportRows = await db
      .select()
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);

    if (reportRows.length === 0) {
      return NextResponse.json(
        { error: "レポートが見つかりません" },
        { status: 404 }
      );
    }

    const report = reportRows[0];

    // Verify the report belongs to the user's account
    const accountRows = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(
        and(
          eq(threadsAccounts.id, report.accountId),
          eq(threadsAccounts.userId, userId)
        )
      )
      .limit(1);

    if (accountRows.length === 0) {
      return NextResponse.json(
        { error: "レポートが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      report: {
        id: report.id,
        accountId: report.accountId,
        type: report.type,
        title: report.title,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        content: report.content,
        summary: report.summary,
        metrics: report.metrics ? JSON.parse(report.metrics) : {},
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/reports/[id] error:", error);
    return NextResponse.json(
      { error: "レポートの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/reports/[id] - Delete a report
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id } = await params;
    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Get the report
    const reportRows = await db
      .select({ id: reports.id, accountId: reports.accountId })
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);

    if (reportRows.length === 0) {
      return NextResponse.json(
        { error: "レポートが見つかりません" },
        { status: 404 }
      );
    }

    // Verify ownership
    const accountRows = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(
        and(
          eq(threadsAccounts.id, reportRows[0].accountId),
          eq(threadsAccounts.userId, userId)
        )
      )
      .limit(1);

    if (accountRows.length === 0) {
      return NextResponse.json(
        { error: "レポートが見つかりません" },
        { status: 404 }
      );
    }

    await db.delete(reports).where(eq(reports.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/reports/[id] error:", error);
    return NextResponse.json(
      { error: "レポートの削除に失敗しました" },
      { status: 500 }
    );
  }
}
