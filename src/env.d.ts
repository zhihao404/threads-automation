// =============================================================================
// Cloudflare Workers environment bindings
// Extends the global CloudflareEnv interface from @opennextjs/cloudflare
// =============================================================================

declare global {
  interface CloudflareEnv {
    // D1 Database
    DB: D1Database;

    // R2 Bucket for media uploads
    MEDIA_BUCKET: R2Bucket;

    // KV Namespace for caching
    CACHE: KVNamespace;

    // Threads API credentials (set via wrangler secret)
    THREADS_APP_ID: string;
    THREADS_APP_SECRET: string;

    // Better Auth secret
    BETTER_AUTH_SECRET: string;

    // Anthropic API key
    ANTHROPIC_API_KEY: string;

    // Encryption key for token storage
    ENCRYPTION_KEY: string;

    // Cloudflare Queue for background job processing
    POST_QUEUE: Queue;

    // App URL
    NEXT_PUBLIC_APP_URL: string;
  }
}

export {};
