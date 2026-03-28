// =============================================================================
// GET /api/webhooks/threads/data-deletion/status?code=CONFIRMATION_CODE
// Returns the status of a data deletion request.
// Meta may query this endpoint after receiving the confirmation code.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { createDb } from "@/db";
import { dataDeletions } from "@/db/schema";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Missing confirmation code" },
      { status: 400 },
    );
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  const rows = await db
    .select({
      id: dataDeletions.id,
      status: dataDeletions.status,
      requestedAt: dataDeletions.requestedAt,
      completedAt: dataDeletions.completedAt,
    })
    .from(dataDeletions)
    .where(eq(dataDeletions.confirmationCode, code))
    .limit(1);

  const deletion = rows[0];

  if (!deletion) {
    return NextResponse.json(
      { error: "Deletion request not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    confirmation_code: code,
    status: deletion.status,
    requested_at: deletion.requestedAt
      ? new Date(deletion.requestedAt).toISOString()
      : null,
    completed_at: deletion.completedAt
      ? new Date(deletion.completedAt).toISOString()
      : null,
  });
}
