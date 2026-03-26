import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { and } from "drizzle-orm";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";

// =============================================================================
// DELETE /api/media/delete
// Delete an uploaded media file from R2 after verifying ownership
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    // 1. Authenticate user
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    // 2. Parse request body
    let body: { key?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "リクエストの形式が正しくありません" },
        { status: 400 }
      );
    }

    const { key } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json(
        { error: "削除するファイルのキーを指定してください" },
        { status: 400 }
      );
    }

    // 3. Validate key format and prevent path traversal
    if (key.includes("..") || key.includes("\0")) {
      return NextResponse.json(
        { error: "無効なキーです" },
        { status: 400 }
      );
    }

    // 4. Verify ownership - the key must contain the user's ID
    // Expected format: uploads/{userId}/{ulid}-{filename}
    const expectedPrefix = `uploads/${userId}/`;
    if (!key.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "このファイルを削除する権限がありません" },
        { status: 403 }
      );
    }

    // 5. Delete from R2
    const { env } = await getCloudflareContext({ async: true });
    const bucket = env.MEDIA_BUCKET;

    // Check if the object exists before deleting
    const object = await bucket.head(key);
    if (!object) {
      return NextResponse.json(
        { error: "ファイルが見つかりません" },
        { status: 404 }
      );
    }

    // Additionally verify ownership via custom metadata
    if (object.customMetadata?.userId && object.customMetadata.userId !== userId) {
      return NextResponse.json(
        { error: "このファイルを削除する権限がありません" },
        { status: 403 }
      );
    }

    await bucket.delete(key);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/media/delete error:", error);
    return NextResponse.json(
      { error: "ファイルの削除に失敗しました" },
      { status: 500 }
    );
  }
}
