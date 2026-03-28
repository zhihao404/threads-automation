// =============================================================================
// Threads API Types
// =============================================================================

/** Reply control options for a Threads post */
export type ReplyControl = "everyone" | "accounts_you_follow" | "mentioned_only";

/** Media types supported by the Threads API */
export type MediaType = "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";

/** Container publishing status */
export type ContainerPublishingStatus =
  | "EXPIRED"
  | "ERROR"
  | "FINISHED"
  | "IN_PROGRESS"
  | "PUBLISHED";

// =============================================================================
// Profile
// =============================================================================

export interface ThreadsProfile {
  id: string;
  username: string;
  name?: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
  is_verified?: boolean;
}

// =============================================================================
// Posts
// =============================================================================

export interface ThreadsPost {
  id: string;
  media_product_type: "THREADS";
  media_type: MediaType;
  media_url?: string;
  permalink?: string;
  owner?: { id: string };
  username?: string;
  text?: string;
  timestamp: string;
  shortcode?: string;
  thumbnail_url?: string;
  children?: { data: Array<{ id: string }> };
  is_quote_post?: boolean;
  alt_text?: string;
  link_attachment_url?: string;
  reply_audience?: ReplyControl;
  has_replies?: boolean;
  root_post?: { id: string };
  replied_to?: { id: string };
  is_reply?: boolean;
  hide_status?: "NOT_HUSHED" | "UNHUSHED" | "HIDDEN" | "COVERED";
}

// =============================================================================
// Container Status
// =============================================================================

export interface ContainerStatus {
  id: string;
  status: ContainerPublishingStatus;
  error_message?: string;
}

// =============================================================================
// Carousel
// =============================================================================

export interface CarouselItem {
  mediaType: "IMAGE" | "VIDEO";
  url: string;
  altText?: string;
}

// =============================================================================
// Insights
// =============================================================================

export interface MetricValue {
  value: number;
}

export interface MetricEntry {
  name: string;
  period: string;
  values: MetricValue[];
  title: string;
  description: string;
  id: string;
}

export interface PostInsights {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}

export interface ProfileInsightsMetric {
  name: string;
  period: string;
  values: Array<{ value: number; end_time?: string }>;
  title: string;
  description: string;
  id: string;
}

export interface ProfileInsights {
  data: ProfileInsightsMetric[];
}

export interface DemographicBreakdown {
  dimension_key: string;
  results: Array<{
    dimension_values: string[];
    value: number;
  }>;
}

export interface DemographicData {
  name: string;
  period: string;
  title: string;
  description: string;
  total_value: DemographicBreakdown;
  id: string;
}

// =============================================================================
// Pagination
// =============================================================================

export interface PaginationCursors {
  before: string;
  after: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  paging?: {
    cursors?: PaginationCursors;
    next?: string;
    previous?: string;
  };
}

// =============================================================================
// Errors
// =============================================================================

export interface ThreadsApiErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export class ThreadsApiError extends Error {
  public readonly type: string;
  public readonly code: number;
  public readonly errorSubcode: number | undefined;
  public readonly fbtraceId: string | undefined;
  public readonly statusCode: number;

  constructor(response: ThreadsApiErrorResponse, statusCode: number) {
    super(response.error.message);
    this.name = "ThreadsApiError";
    this.type = response.error.type;
    this.code = response.error.code;
    this.errorSubcode = response.error.error_subcode;
    this.fbtraceId = response.error.fbtrace_id;
    this.statusCode = statusCode;
  }

  /** Whether this error is due to rate limiting */
  get isRateLimited(): boolean {
    return this.statusCode === 429 || this.code === 4 || this.code === 32;
  }

  /** Whether this error is due to an expired or invalid token */
  get isAuthError(): boolean {
    return this.code === 190 || this.type === "OAuthException";
  }
}

// =============================================================================
// OAuth
// =============================================================================

export interface ShortLivedTokenResponse {
  access_token: string;
  user_id: number;
}

export interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// =============================================================================
// API Request Params
// =============================================================================

export interface CreateTextPostParams {
  text: string;
  replyControl?: ReplyControl;
  topicTag?: string;
  replyToId?: string;
  linkAttachment?: string;
}

export interface CreateImagePostParams {
  text?: string;
  imageUrl: string;
  altText?: string;
  replyControl?: ReplyControl;
  topicTag?: string;
}

export interface CreateVideoPostParams {
  text?: string;
  videoUrl: string;
  altText?: string;
  replyControl?: ReplyControl;
  topicTag?: string;
}

export interface CreateCarouselPostParams {
  text?: string;
  children: CarouselItem[];
  replyControl?: ReplyControl;
  topicTag?: string;
}

export interface GetUserPostsParams {
  limit?: number;
  after?: string;
  before?: string;
}

export interface GetProfileInsightsParams {
  since: number;
  until: number;
  metric?: string[];
}
