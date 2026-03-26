import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// =============================================================================
// GET /api/media/uploads/{userId}/{filename}
// Serve uploaded media files from R2 with appropriate caching headers
// =============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key } = await params;

    // Reconstruct the full object key from the catch-all segments
    const objectKey = key.join("/");

    // Validate the key format to prevent abuse
    // Expected format: uploads/{userId}/{ulid}-{filename}
    if (!objectKey.startsWith("uploads/")) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Prevent path traversal attacks
    if (objectKey.includes("..") || objectKey.includes("\0")) {
      return new NextResponse("Bad Request", { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });
    const bucket = env.MEDIA_BUCKET;

    // Get the object from R2
    const object = await bucket.get(objectKey);

    if (!object) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Determine content type from R2 metadata or fall back to octet-stream
    const contentType =
      object.httpMetadata?.contentType || "application/octet-stream";

    // Stream the response body from R2 directly (no buffering)
    const headers = new Headers();
    headers.set("Content-Type", contentType);

    // Media files are immutable (keyed by ULID), so we can cache aggressively
    // Cache for 1 year in browsers and CDN
    headers.set(
      "Cache-Control",
      "public, max-age=31536000, immutable"
    );

    // Set content length if available
    if (object.size !== undefined) {
      headers.set("Content-Length", object.size.toString());
    }

    // Set ETag for conditional requests
    headers.set("ETag", object.httpEtag);

    return new NextResponse(object.body as ReadableStream, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("GET /api/media/[...key] error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
