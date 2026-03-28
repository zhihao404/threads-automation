// =============================================================================
// Threads API Client
// =============================================================================

import {
  type CarouselItem,
  type ContainerStatus,
  type CreateCarouselPostParams,
  type CreateImagePostParams,
  type CreateTextPostParams,
  type CreateVideoPostParams,
  type DemographicData,
  type GetProfileInsightsParams,
  type GetUserPostsParams,
  type MetricEntry,
  type PaginatedResponse,
  type PostInsights,
  type ProfileInsights,
  ThreadsApiError,
  type ThreadsApiErrorResponse,
  type ThreadsPost,
  type ThreadsProfile,
} from "./types";

const THREADS_API_BASE = "https://graph.threads.net/v1.0";

/** All post fields requested from the Threads API */
const POST_FIELDS = [
  "id",
  "media_product_type",
  "media_type",
  "media_url",
  "permalink",
  "owner",
  "username",
  "text",
  "timestamp",
  "shortcode",
  "thumbnail_url",
  "children",
  "is_quote_post",
  "alt_text",
  "link_attachment_url",
  "reply_audience",
  "has_replies",
  "root_post",
  "replied_to",
  "is_reply",
  "hide_status",
].join(",");

/** Profile fields requested from the Threads API */
const PROFILE_FIELDS = [
  "id",
  "username",
  "name",
  "threads_profile_picture_url",
  "threads_biography",
  "is_verified",
].join(",");

/**
 * A comprehensive client for the Threads API.
 *
 * Uses the 2-step container model for publishing posts:
 * 1. Create a media container
 * 2. Publish the container
 *
 * For carousel posts, a 3-step process is used:
 * 1. Create child containers for each media item
 * 2. Create the carousel container referencing the children
 * 3. Publish the carousel container
 */
export class ThreadsClient {
  private userId: string | null;

  /**
   * @param accessToken - A valid Threads API access token
   * @param userId - Optional Threads user ID. If provided, avoids an extra API
   *                 call to fetch the profile for the user ID.
   */
  constructor(
    private accessToken: string,
    userId?: string,
  ) {
    this.userId = userId ?? null;
  }

  // ===========================================================================
  // Profile
  // ===========================================================================

  /**
   * Fetches the authenticated user's Threads profile.
   */
  async getProfile(): Promise<ThreadsProfile> {
    return this.request<ThreadsProfile>(`/me?fields=${PROFILE_FIELDS}`);
  }

  // ===========================================================================
  // Publishing - Container Creation
  // ===========================================================================

  /**
   * Creates a text post container.
   * Returns the container ID. Use `publishPost()` to publish it.
   */
  async createTextPost(params: CreateTextPostParams): Promise<string> {
    const userId = await this.getUserId();

    const containerParams: Record<string, string> = {
      media_type: "TEXT",
      text: params.text,
    };

    if (params.replyControl) {
      containerParams.reply_control = params.replyControl;
    }
    if (params.topicTag) {
      containerParams.topic_tag = params.topicTag;
    }
    if (params.replyToId) {
      containerParams.reply_to_id = params.replyToId;
    }
    if (params.linkAttachment) {
      containerParams.link_attachment = params.linkAttachment;
    }

    return this.createContainer(userId, containerParams);
  }

  /**
   * Creates an image post container.
   * Returns the container ID. Use `publishPost()` to publish it.
   */
  async createImagePost(params: CreateImagePostParams): Promise<string> {
    const userId = await this.getUserId();

    const containerParams: Record<string, string> = {
      media_type: "IMAGE",
      image_url: params.imageUrl,
    };

    if (params.text) {
      containerParams.text = params.text;
    }
    if (params.altText) {
      containerParams.alt_text = params.altText;
    }
    if (params.replyControl) {
      containerParams.reply_control = params.replyControl;
    }
    if (params.topicTag) {
      containerParams.topic_tag = params.topicTag;
    }

    return this.createContainer(userId, containerParams);
  }

  /**
   * Creates a video post container.
   * Returns the container ID. Use `publishPost()` to publish it.
   *
   * Note: Video processing is asynchronous. Use `waitForContainerReady()`
   * or poll `getContainerStatus()` to wait for processing before publishing.
   */
  async createVideoPost(params: CreateVideoPostParams): Promise<string> {
    const userId = await this.getUserId();

    const containerParams: Record<string, string> = {
      media_type: "VIDEO",
      video_url: params.videoUrl,
    };

    if (params.text) {
      containerParams.text = params.text;
    }
    if (params.altText) {
      containerParams.alt_text = params.altText;
    }
    if (params.replyControl) {
      containerParams.reply_control = params.replyControl;
    }
    if (params.topicTag) {
      containerParams.topic_tag = params.topicTag;
    }

    return this.createContainer(userId, containerParams);
  }

  /**
   * Creates a carousel post container (2-20 media items).
   * Uses a 3-step process:
   * 1. Create child containers for each media item
   * 2. Create the carousel container referencing the children
   * 3. Use `publishPost()` to publish the returned container ID
   *
   * Returns the carousel container ID.
   */
  async createCarouselPost(params: CreateCarouselPostParams): Promise<string> {
    const userId = await this.getUserId();

    if (params.children.length < 2 || params.children.length > 20) {
      throw new Error("Carousel posts must have between 2 and 20 items");
    }

    // Step 1: Create child containers
    const childIds = await Promise.all(
      params.children.map((child) => this.createChildContainer(userId, child)),
    );

    // Wait for any video children to finish processing
    await Promise.all(
      params.children.map(async (child, index) => {
        if (child.mediaType === "VIDEO") {
          await this.waitForContainerReady(childIds[index]!);
        }
      }),
    );

    // Step 2: Create carousel container
    const containerParams: Record<string, string> = {
      media_type: "CAROUSEL",
      children: childIds.join(","),
    };

    if (params.text) {
      containerParams.text = params.text;
    }
    if (params.replyControl) {
      containerParams.reply_control = params.replyControl;
    }
    if (params.topicTag) {
      containerParams.topic_tag = params.topicTag;
    }

    return this.createContainer(userId, containerParams);
  }

  // ===========================================================================
  // Publishing - Publish
  // ===========================================================================

  /**
   * Publishes a previously created media container.
   * Returns an object with the published post's ID.
   *
   * @param containerId - The container ID returned by a create*Post method
   */
  async publishPost(containerId: string): Promise<{ id: string }> {
    const userId = await this.getUserId();
    return this.publishContainer(userId, containerId);
  }

  /**
   * Gets the current status of a media container.
   * Useful for polling video container status before publishing.
   */
  async getContainerStatus(containerId: string): Promise<ContainerStatus> {
    return this.request<ContainerStatus>(
      `/${containerId}?fields=id,status,error_message`,
    );
  }

  /**
   * Waits for a container to reach FINISHED status.
   * Useful for video containers that require server-side processing.
   *
   * @param containerId - The container to wait for
   * @param maxAttempts - Maximum number of polling attempts (default: 30)
   * @param intervalMs - Milliseconds between polls (default: 2000)
   * @throws Error if the container enters an ERROR or EXPIRED state
   * @throws Error if polling exceeds the maximum number of attempts
   */
  async waitForContainerReady(
    containerId: string,
    maxAttempts = 30,
    intervalMs = 2000,
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await this.getContainerStatus(containerId);

      if (status.status === "FINISHED") {
        return;
      }

      if (status.status === "ERROR") {
        throw new Error(
          `Container ${containerId} failed: ${status.error_message ?? "Unknown error"}`,
        );
      }

      if (status.status === "EXPIRED") {
        throw new Error(`Container ${containerId} has expired`);
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(
      `Container ${containerId} did not finish processing after ${maxAttempts} attempts`,
    );
  }

  // ===========================================================================
  // Posts
  // ===========================================================================

  /**
   * Retrieves the authenticated user's posts with pagination.
   */
  async getUserPosts(
    params?: GetUserPostsParams,
  ): Promise<PaginatedResponse<ThreadsPost>> {
    const userId = await this.getUserId();
    const searchParams = new URLSearchParams({ fields: POST_FIELDS });

    if (params?.limit) {
      searchParams.set("limit", String(params.limit));
    }
    if (params?.after) {
      searchParams.set("after", params.after);
    }
    if (params?.before) {
      searchParams.set("before", params.before);
    }

    return this.request<PaginatedResponse<ThreadsPost>>(
      `/${userId}/threads?${searchParams.toString()}`,
    );
  }

  /**
   * Retrieves a single post by ID.
   */
  async getPost(postId: string): Promise<ThreadsPost> {
    return this.request<ThreadsPost>(`/${postId}?fields=${POST_FIELDS}`);
  }

  /**
   * Deletes a post by ID.
   */
  async deletePost(postId: string): Promise<void> {
    await this.request<{ success: boolean }>(`/${postId}`, {
      method: "DELETE",
    });
  }

  // ===========================================================================
  // Insights
  // ===========================================================================

  /**
   * Retrieves insights/metrics for a specific post.
   */
  async getPostInsights(postId: string): Promise<PostInsights> {
    const metrics = "views,likes,replies,reposts,quotes,shares";
    const response = await this.request<{ data: MetricEntry[] }>(
      `/${postId}/insights?metric=${metrics}`,
    );

    const result: PostInsights = {
      views: 0,
      likes: 0,
      replies: 0,
      reposts: 0,
      quotes: 0,
      shares: 0,
    };

    for (const entry of response.data) {
      const metricName = entry.name as keyof PostInsights;
      if (metricName in result && entry.values.length > 0) {
        result[metricName] = entry.values[0]!.value;
      }
    }

    return result;
  }

  /**
   * Retrieves profile-level insights for a date range.
   * Requires the `threads_manage_insights` scope.
   *
   * @param params.since - Unix timestamp for the start of the range
   * @param params.until - Unix timestamp for the end of the range
   * @param params.metric - Optional specific metrics (defaults to all available)
   */
  async getProfileInsights(params: GetProfileInsightsParams): Promise<ProfileInsights> {
    const userId = await this.getUserId();
    const defaultMetrics = [
      "views",
      "likes",
      "replies",
      "reposts",
      "quotes",
      "followers_count",
    ];
    const metrics = params.metric ?? defaultMetrics;

    const searchParams = new URLSearchParams({
      metric: metrics.join(","),
      since: String(params.since),
      until: String(params.until),
    });

    return this.request<ProfileInsights>(
      `/${userId}/threads_insights?${searchParams.toString()}`,
    );
  }

  /**
   * Retrieves follower demographics data.
   * Requires at least 100 followers.
   *
   * @param breakdown - The demographic dimension to break down by
   */
  async getFollowerDemographics(
    breakdown: "country" | "city" | "age" | "gender",
  ): Promise<DemographicData> {
    const userId = await this.getUserId();
    const response = await this.request<{ data: DemographicData[] }>(
      `/${userId}/threads_insights?metric=follower_demographics&breakdown=${breakdown}`,
    );

    if (response.data.length === 0) {
      throw new Error(
        "No demographic data available. At least 100 followers are required.",
      );
    }

    return response.data[0]!;
  }

  // ===========================================================================
  // Replies
  // ===========================================================================

  /**
   * Retrieves replies to a specific post.
   */
  async getReplies(
    postId: string,
  ): Promise<PaginatedResponse<ThreadsPost>> {
    return this.request<PaginatedResponse<ThreadsPost>>(
      `/${postId}/replies?fields=${POST_FIELDS}`,
    );
  }

  /**
   * Hides or unhides a reply on the authenticated user's post.
   */
  async hideReply(replyId: string, hide: boolean): Promise<void> {
    await this.request<{ success: boolean }>(`/${replyId}/manage_reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hide }),
    });
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Gets the authenticated user's Threads user ID.
   * Returns the cached userId if available (e.g., passed in constructor),
   * otherwise fetches the profile.
   */
  private async getUserId(): Promise<string> {
    if (this.userId) {
      return this.userId;
    }

    const profile = await this.getProfile();
    this.userId = profile.id;
    return this.userId;
  }

  /**
   * Creates a media container for a single post.
   * Returns the container creation ID.
   */
  private async createContainer(
    userId: string,
    params: Record<string, string>,
  ): Promise<string> {
    const searchParams = new URLSearchParams(params);
    const response = await this.request<{ id: string }>(
      `/${userId}/threads?${searchParams.toString()}`,
      { method: "POST" },
    );
    return response.id;
  }

  /**
   * Creates a child container for carousel items.
   * Returns the container ID.
   */
  private async createChildContainer(
    userId: string,
    item: CarouselItem,
  ): Promise<string> {
    const params: Record<string, string> = {
      media_type: item.mediaType,
      is_carousel_item: "true",
    };

    if (item.mediaType === "IMAGE") {
      params.image_url = item.url;
    } else {
      params.video_url = item.url;
    }

    if (item.altText) {
      params.alt_text = item.altText;
    }

    const searchParams = new URLSearchParams(params);
    const response = await this.request<{ id: string }>(
      `/${userId}/threads?${searchParams.toString()}`,
      { method: "POST" },
    );
    return response.id;
  }

  /**
   * Publishes a media container.
   * Returns an object containing the published media ID.
   */
  private async publishContainer(
    userId: string,
    containerId: string,
  ): Promise<{ id: string }> {
    const searchParams = new URLSearchParams({
      creation_id: containerId,
    });
    return this.request<{ id: string }>(
      `/${userId}/threads_publish?${searchParams.toString()}`,
      { method: "POST" },
    );
  }

  /**
   * Makes an authenticated request to the Threads API.
   * Handles error responses and rate limiting.
   *
   * @param path - API path (e.g., "/me" or "/{userId}/threads")
   * @param options - Additional fetch options
   * @returns Parsed JSON response
   * @throws ThreadsApiError for API errors
   */
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = new URL(`${THREADS_API_BASE}${path}`);

    // Add access token to all requests
    url.searchParams.set("access_token", this.accessToken);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        ...options,
        signal: controller.signal,
        headers: {
          ...options?.headers,
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let errorBody: ThreadsApiErrorResponse;
      try {
        errorBody = (await response.json()) as ThreadsApiErrorResponse;
      } catch {
        throw new Error(
          `Threads API error: ${response.status} ${response.statusText}`,
        );
      }

      throw new ThreadsApiError(errorBody, response.status);
    }

    return (await response.json()) as T;
  }
}
