import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAuthenticatedUserId } from "@/lib/auth-helpers";
import { apiError } from "@/lib/api-response";

// =============================================================================
// DELETE /api/media/delete
// Delete an uploaded media file from R2 after verifying ownership
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    // 1. Authenticate user
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return apiError("認証が必要です", 401);
    }

    // 2. Parse request body
    let body: { key?: string };
    try {
      body = await request.json();
    } catch {
      return apiError("リクエストの形式が正しくありません", 400);
    }

    const { key } = body;

    if (!key || typeof key !== "string") {
      return apiError("削除するファイルのキーを指定してください", 400);
    }

    // 3. Validate key format and prevent path traversal
    if (key.includes("..") || key.includes("\0")) {
      return apiError("無効なキーです", 400);
    }

    // 4. Verify ownership - the key must contain the user's ID
    // Expected format: uploads/{userId}/{ulid}-{filename}
    const expectedPrefix = `uploads/${userId}/`;
    if (!key.startsWith(expectedPrefix)) {
      return apiError("このファイルを削除する権限がありません", 403);
    }

    // 5. Delete from R2
    const { env } = await getCloudflareContext({ async: true });
    const bucket = env.MEDIA_BUCKET;

    // Check if the object exists before deleting
    const object = await bucket.head(key);
    if (!object) {
      return apiError("ファイルが見つかりません", 404);
    }

    // Additionally verify ownership via custom metadata
    if (object.customMetadata?.userId && object.customMetadata.userId !== userId) {
      return apiError("このファイルを削除する権限がありません", 403);
    }

    await bucket.delete(key);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/media/delete error:", error);
    return apiError("ファイルの削除に失敗しました", 500);
  }
}
