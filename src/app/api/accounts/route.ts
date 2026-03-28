import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { apiError } from "@/lib/api-response";
import { listUserAccounts } from "@/lib/accounts/service";

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return apiError("認証が必要です", 401);
    }

    const { env } = await getCloudflareContext({ async: true });
    const db = createDb(env.DB);

    const accountsWithStatus = await listUserAccounts(db, userId);

    return NextResponse.json({ accounts: accountsWithStatus });
  } catch (error) {
    console.error("GET /api/accounts error:", error);
    return apiError("アカウント情報の取得に失敗しました", 500);
  }
}
