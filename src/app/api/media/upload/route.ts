import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/db";
import { session } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import {
  validateFile,
  generateObjectKey,
  getPublicUrl,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
} from "@/lib/media/upload";
import type { UploadResult } from "@/lib/media/upload";

// =============================================================================
// POST /api/media/upload
// Accept multipart/form-data with file and type fields
// =============================================================================

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

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    // 2. Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "リクエストの形式が正しくありません。multipart/form-data で送信してください。" },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    const mediaType = formData.get("type") as string | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "ファイルが指定されていません" },
        { status: 400 }
      );
    }

    if (!mediaType || (mediaType !== "image" && mediaType !== "video")) {
      return NextResponse.json(
        { error: "メディアタイプを指定してください (image または video)" },
        { status: 400 }
      );
    }

    // 3. Server-side validation of file type and size
    // Double-check MIME type against allowed types (defense in depth)
    const allowedTypes =
      mediaType === "image"
        ? (ALLOWED_IMAGE_TYPES as readonly string[])
        : (ALLOWED_VIDEO_TYPES as readonly string[]);

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            mediaType === "image"
              ? "サポートされていない画像形式です。JPEG または PNG のみ対応しています。"
              : "サポートされていない動画形式です。MP4 または QuickTime のみ対応しています。",
        },
        { status: 400 }
      );
    }

    const maxSize = mediaType === "image" ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: `ファイルサイズが大きすぎます。最大 ${mediaType === "image" ? "8MB" : "1GB"} まで対応しています。`,
        },
        { status: 400 }
      );
    }

    // Also run the shared validation function for consistency
    const validation = validateFile(file, mediaType);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // 4. Generate unique R2 object key
    const objectKey = generateObjectKey(file.name, userId);

    // 5. Upload to R2
    const { env } = await getCloudflareContext({ async: true });
    const bucket = env.MEDIA_BUCKET;

    const fileBuffer = await file.arrayBuffer();

    await bucket.put(objectKey, fileBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        userId,
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    // 6. Return the public URL
    const publicUrl = getPublicUrl(objectKey, env.NEXT_PUBLIC_APP_URL);

    const result: UploadResult = {
      key: objectKey,
      url: publicUrl,
      contentType: file.type,
      size: file.size,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/media/upload error:", error);
    return NextResponse.json(
      { error: "ファイルのアップロードに失敗しました" },
      { status: 500 }
    );
  }
}
