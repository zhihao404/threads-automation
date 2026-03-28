// =============================================================================
// Worker Utility Functions
// =============================================================================

/** Determines media type based on URL file extension */
export function getMediaType(url: string): "IMAGE" | "VIDEO" {
  const videoExtensions = [".mp4", ".mov", ".avi", ".webm", ".m4v"];
  const lowerUrl = url.toLowerCase().split("?")[0]!; // Remove query parameters
  return videoExtensions.some(ext => lowerUrl.endsWith(ext)) ? "VIDEO" : "IMAGE";
}
