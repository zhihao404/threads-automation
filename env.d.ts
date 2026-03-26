/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  CACHE: KVNamespace;
  NEXT_PUBLIC_APP_URL: string;
  THREADS_APP_ID: string;
  THREADS_APP_SECRET: string;
  BETTER_AUTH_SECRET: string;
  ANTHROPIC_API_KEY: string;
  ENCRYPTION_KEY: string;
  POST_QUEUE: Queue;
}
