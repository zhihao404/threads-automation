// =============================================================================
// Worker Environment Types
// =============================================================================

import type { JobMessage } from "../src/lib/queue/types";

export interface Env {
  DB: D1Database;
  POST_QUEUE: Queue;
  ENCRYPTION_KEY: string;
}

/**
 * Cloudflare Queue MessageBatch type for the worker consumer.
 */
export type JobMessageBatch = MessageBatch<JobMessage>;
