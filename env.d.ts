/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  CACHE: KVNamespace;
  NEXT_PUBLIC_APP_URL: string;
  THREADS_APP_ID: string;
  THREADS_APP_SECRET: string;
  BETTER_AUTH_SECRET: string;
  AI_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  ENCRYPTION_KEY: string;
  POST_QUEUE: Queue;
}
