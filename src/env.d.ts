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

    // AI provider selection and credentials
    AI_PROVIDER?: string;
    ANTHROPIC_API_KEY?: string;
    ANTHROPIC_MODEL?: string;
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;

    // Encryption key for token storage
    ENCRYPTION_KEY: string;

    // Cloudflare Queue for background job processing
    POST_QUEUE: Queue;

    // Webhook verify token (set via wrangler secret)
    WEBHOOK_VERIFY_TOKEN: string;

    // Stripe
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    STRIPE_PRO_PRICE_ID: string;
    STRIPE_BUSINESS_PRICE_ID: string;

    // App URL
    NEXT_PUBLIC_APP_URL: string;
  }
}

export {};
