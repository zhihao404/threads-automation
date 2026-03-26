import { ulid } from "ulid";

// =============================================================================
// Media file validation and processing utilities
// =============================================================================

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"] as const;
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"] as const;
export const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB
export const MAX_VIDEO_SIZE = 1 * 1024 * 1024 * 1024; // 1GB

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];
export type AllowedVideoType = (typeof ALLOWED_VIDEO_TYPES)[number];

export interface UploadResult {
  key: string; // R2 object key
  url: string; // Public URL for the media
  contentType: string;
  size: number;
}

/**
 * Validate a file against Threads API requirements.
 * Checks file type and size based on whether it's an image or video upload.
 */
export function validateFile(
  file: File,
  type: "image" | "video"
): { valid: boolean; error?: string } {
  if (type === "image") {
    if (
      !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)
    ) {
      return {
        valid: false,
        error: `サポートされていない画像形式です。JPEG または PNG のみ対応しています。(受信: ${file.type || "不明"})`,
      };
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return {
        valid: false,
        error: `画像サイズが大きすぎます。最大 ${formatFileSize(MAX_IMAGE_SIZE)} まで対応しています。(サイズ: ${formatFileSize(file.size)})`,
      };
    }
  } else {
    if (
      !(ALLOWED_VIDEO_TYPES as readonly string[]).includes(file.type)
    ) {
      return {
        valid: false,
        error: `サポートされていない動画形式です。MP4 または QuickTime のみ対応しています。(受信: ${file.type || "不明"})`,
      };
    }
    if (file.size > MAX_VIDEO_SIZE) {
      return {
        valid: false,
        error: `動画サイズが大きすぎます。最大 ${formatFileSize(MAX_VIDEO_SIZE)} まで対応しています。(サイズ: ${formatFileSize(file.size)})`,
      };
    }
  }

  return { valid: true };
}

/**
 * Sanitize a filename to prevent path traversal and other attacks.
 * Removes directory separators, null bytes, and other dangerous characters.
 */
function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  let sanitized = filename
    .replace(/[/\\]/g, "_")
    .replace(/\0/g, "")
    .replace(/\.\./g, "_");

  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\.+/, "");

  // Only allow alphanumeric, hyphens, underscores, dots
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, "_");

  // Ensure we have a filename
  if (!sanitized || sanitized === "_") {
    sanitized = "upload";
  }

  // Limit length
  if (sanitized.length > 100) {
    const ext = sanitized.split(".").pop() || "";
    const name = sanitized.slice(0, 90);
    sanitized = ext ? `${name}.${ext}` : name;
  }

  return sanitized;
}

/**
 * Generate a unique R2 object key for an uploaded file.
 * Format: uploads/{userId}/{ulid}-{sanitized-filename}
 */
export function generateObjectKey(filename: string, userId: string): string {
  const sanitized = sanitizeFilename(filename);
  const id = ulid();
  return `uploads/${userId}/${id}-${sanitized}`;
}

/**
 * Get the public URL for an R2 object given its key and the base URL.
 */
export function getPublicUrl(key: string, baseUrl: string): string {
  // Ensure no double slashes between base URL and key
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  return `${trimmedBase}/api/media/${key}`;
}

/**
 * Format file size in human-readable form (KB, MB, GB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);

  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Get the accepted MIME types string for file inputs.
 */
export function getAcceptString(type: "image" | "video"): string {
  if (type === "image") {
    return ALLOWED_IMAGE_TYPES.join(",");
  }
  return ALLOWED_VIDEO_TYPES.join(",");
}
