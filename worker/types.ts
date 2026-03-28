// =============================================================================
// Worker Environment Types
// =============================================================================

import type { JobMessage } from "../src/lib/queue/types";

export interface Env {
  DB: D1Database;
  POST_QUEUE: Queue;
  ENCRYPTION_KEY: string;
  // AI provider configuration (needed for report generation)
  AI_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

/**
 * Cloudflare Queue MessageBatch type for the worker consumer.
 */
export type JobMessageBatch = MessageBatch<JobMessage>;
