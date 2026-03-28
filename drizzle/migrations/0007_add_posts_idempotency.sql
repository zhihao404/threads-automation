-- Add idempotency and error tracking columns to posts
ALTER TABLE posts ADD COLUMN dedupe_key text;
--> statement-breakpoint
ALTER TABLE posts ADD COLUMN container_id text;
--> statement-breakpoint
ALTER TABLE posts ADD COLUMN last_error_category text;
--> statement-breakpoint
ALTER TABLE posts ADD COLUMN max_retries integer NOT NULL DEFAULT 3;
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_dedupe_key_idx` ON `posts` (`dedupe_key`);
