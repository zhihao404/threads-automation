// =============================================================================
// Queue Job Message Types
// Used by both the Next.js app (producer) and the Cloudflare Worker (consumer)
// =============================================================================

export type PostJobMessage = {
  type: "publish_post";
  postId: string;
  accountId: string;
};

export type QueueJobMessage = {
  type: "process_queue";
  accountId: string;
};

export type MetricsJobMessage = {
  type: "collect_metrics";
  accountId: string;
};

export type TokenRefreshMessage = {
  type: "refresh_token";
  accountId: string;
};

export type GenerateReportMessage = {
  type: "generate_report";
  reportId: string;
  accountId: string;
};

export type JobMessage =
  | PostJobMessage
  | QueueJobMessage
  | MetricsJobMessage
  | TokenRefreshMessage
  | GenerateReportMessage;
