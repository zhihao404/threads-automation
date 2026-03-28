import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { threadsAccounts, reports } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { apiError } from "@/lib/api-response";

// GET /api/reports/[id] - Get full report with HTML content
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return apiError("認証が必要です", 401);
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
      return apiError("レポートが見つかりません", 404);
    }

    const report = reportRows[0]!;

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
      return apiError("レポートが見つかりません", 404);
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
    return apiError("レポートの取得に失敗しました", 500);
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
      return apiError("認証が必要です", 401);
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
      return apiError("レポートが見つかりません", 404);
    }

    // Verify ownership
    const accountRows = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(
        and(
          eq(threadsAccounts.id, reportRows[0]!.accountId),
          eq(threadsAccounts.userId, userId)
        )
      )
      .limit(1);

    if (accountRows.length === 0) {
      return apiError("レポートが見つかりません", 404);
    }

    await db.delete(reports).where(eq(reports.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/reports/[id] error:", error);
    return apiError("レポートの削除に失敗しました", 500);
  }
}
