import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import {
  threadsAccounts,
  reports,
} from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { guardFeatureAccess } from "@/lib/plans/guard";
import { AIConfigurationError, resolveAIProvider } from "@/lib/ai/provider";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { apiError } from "@/lib/api-response";
import type { GenerateReportMessage } from "@/lib/queue/types";

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// GET /api/reports?accountId=xxx&limit=10
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return apiError("認証が必要です", 401);
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const parsedLimit = parseInt(searchParams.get("limit") || "20");
    const limit = isNaN(parsedLimit) || parsedLimit < 1 ? 20 : Math.min(parsedLimit, 50);

    // Get user's accounts
    const userAccounts = await db
      .select({ id: threadsAccounts.id })
      .from(threadsAccounts)
      .where(eq(threadsAccounts.userId, userId));

    if (userAccounts.length === 0) {
      return NextResponse.json({ reports: [] });
    }

    const accountIds = accountId
      ? userAccounts.filter((a) => a.id === accountId).map((a) => a.id)
      : userAccounts.map((a) => a.id);

    if (accountIds.length === 0) {
      return apiError("アカウントが見つかりません", 404);
    }

    const accountInClause = sql`${reports.accountId} IN (${sql.join(
      accountIds.map((id) => sql`${id}`),
      sql`, `
    )})`;

    const reportRows = await db
      .select({
        id: reports.id,
        accountId: reports.accountId,
        type: reports.type,
        title: reports.title,
        periodStart: reports.periodStart,
        periodEnd: reports.periodEnd,
        summary: reports.summary,
        status: reports.status,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .where(accountInClause)
      .orderBy(desc(reports.createdAt))
      .limit(limit);

    return NextResponse.json({
      reports: reportRows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return apiError("レポートの取得に失敗しました", 500);
  }
}

// POST /api/reports - Generate a new report
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return apiError("認証が必要です", 401);
    }

    const body = await request.json();
    const { accountId, type } = body as {
      accountId: string;
      type: "weekly" | "monthly";
    };

    if (!accountId || !type || !["weekly", "monthly"].includes(type)) {
      return apiError("accountIdとtype（weekly/monthly）が必要です", 400);
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    // Check report feature access based on plan
    // "weekly" reports require at least "weekly" access, "monthly" requires "full"
    const requiredLevel = type === "monthly" ? "full" : "weekly";
    const featureResponse = await guardFeatureAccess(db, userId, "reports", requiredLevel);
    if (featureResponse) return featureResponse;

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
      return apiError("アカウントが見つかりません", 404);
    }

    const aiConfig = (() => {
      try {
        return resolveAIProvider(env);
      } catch (error) {
        if (error instanceof AIConfigurationError) {
          return error;
        }
        throw error;
      }
    })();

    if (aiConfig instanceof AIConfigurationError) {
      return apiError(aiConfig.message, 503);
    }

    // Calculate period
    const now = new Date();
    const days = type === "weekly" ? 7 : 30;
    const periodEnd = new Date(now);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - days);

    const periodStartStr = formatDate(periodStart);
    const periodEndStr = formatDate(periodEnd);

    // Create the report record with "generating" status
    const reportId = ulid();
    await db.insert(reports).values({
      id: reportId,
      accountId,
      type,
      title: `${type === "weekly" ? "週次" : "月次"}レポート生成中...`,
      periodStart: periodStartStr,
      periodEnd: periodEndStr,
      content: "",
      summary: "",
      metrics: "{}",
      status: "generating",
      createdAt: now,
    });

    // Send report generation job to the queue for async processing
    const queueMessage: GenerateReportMessage = {
      type: "generate_report",
      reportId,
      accountId,
    };
    await env.POST_QUEUE.send(queueMessage);

    // Return immediately with the generating status
    return NextResponse.json({
      report: {
        id: reportId,
        accountId,
        type,
        title: `${type === "weekly" ? "週次" : "月次"}レポート生成中...`,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        summary: "",
        status: "generating",
        createdAt: now.toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error("POST /api/reports error:", error);
    return apiError("処理中にエラーが発生しました", 500);
  }
}
