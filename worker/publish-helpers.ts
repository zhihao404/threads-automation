// =============================================================================
// Shared Publishing Helpers
// Common logic for creating media containers across publish-post and process-queue handlers
// =============================================================================

import type { ThreadsClient } from "./threads-client";
import { getMediaType } from "./utils";

type ReplyControl = "everyone" | "accounts_you_follow" | "mentioned_only";

interface PostData {
  content: string;
  mediaType: string;
  mediaUrls: string | null;
  replyControl: string;
  topicTag: string | null;
}

/**
 * Creates a Threads media container for a post based on its media type.
 * Handles TEXT, IMAGE, VIDEO, and CAROUSEL post types.
 * For VIDEO posts, waits for the container to be ready before returning.
 */
export async function createMediaContainer(
  client: ThreadsClient,
  post: PostData,
): Promise<string> {
  const mediaUrls: string[] = post.mediaUrls ? JSON.parse(post.mediaUrls) : [];
  const replyControl = post.replyControl as ReplyControl;
  const topicTag = post.topicTag ?? undefined;

  switch (post.mediaType) {
    case "TEXT":
      return client.createTextPost({
        text: post.content,
        replyControl,
        topicTag,
      });

    case "IMAGE": {
      if (!mediaUrls[0]) {
        throw new Error("Image post requires at least one media URL");
      }
      return client.createImagePost({
        text: post.content,
        imageUrl: mediaUrls[0],
        replyControl,
        topicTag,
      });
    }

    case "VIDEO": {
      if (!mediaUrls[0]) {
        throw new Error("Video post requires at least one media URL");
      }
      const containerId = await client.createVideoPost({
        text: post.content,
        videoUrl: mediaUrls[0],
        replyControl,
        topicTag,
      });
      await client.waitForContainerReady(containerId);
      return containerId;
    }

    case "CAROUSEL": {
      if (!mediaUrls || mediaUrls.length < 2) {
        throw new Error("Carousel post requires at least 2 media URLs");
      }
      return client.createCarouselPost({
        text: post.content,
        children: mediaUrls.map((url) => ({
          mediaType: getMediaType(url),
          url,
        })),
        replyControl,
        topicTag,
      });
    }

    default:
      throw new Error(`Unsupported media type: ${post.mediaType}`);
  }
}

/**
 * Publishes a media container and fetches its permalink.
 * Returns the published media ID and permalink (if available).
 */
export async function publishAndGetPermalink(
  client: ThreadsClient,
  containerId: string,
): Promise<{ id: string; permalink: string | null }> {
  const publishResult = await client.publishPost(containerId);

  let permalink: string | null = null;
  try {
    const threadPost = await client.getPost(publishResult.id);
    permalink = threadPost.permalink ?? null;
  } catch {
    // Permalink fetch is non-critical
  }

  return { id: publishResult.id, permalink };
}
