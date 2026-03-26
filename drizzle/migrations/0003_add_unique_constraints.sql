CREATE TABLE IF NOT EXISTS `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL REFERENCES `threads_accounts`(`id`) ON DELETE CASCADE,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`content` text NOT NULL,
	`summary` text NOT NULL,
	`metrics` text NOT NULL,
	`status` text NOT NULL DEFAULT 'generating',
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reports_account_id_idx` ON `reports` (`account_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reports_created_at_idx` ON `reports` (`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`stripe_customer_id` text NOT NULL,
	`stripe_subscription_id` text,
	`stripe_price_id` text,
	`plan` text NOT NULL DEFAULT 'free',
	`status` text NOT NULL DEFAULT 'active',
	`current_period_start` integer,
	`current_period_end` integer,
	`cancel_at_period_end` integer NOT NULL DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `usage_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`type` text NOT NULL,
	`count` integer NOT NULL DEFAULT 0,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `usage_records_user_period_idx` ON `usage_records` (`user_id`, `period_start`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `threads_accounts_threads_user_id_idx` ON `threads_accounts` (`threads_user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `subscriptions_user_id_idx` ON `subscriptions` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `subscriptions_stripe_subscription_id_idx` ON `subscriptions` (`stripe_subscription_id`);
--> statement-breakpoint
DROP INDEX IF EXISTS `account_metrics_account_id_date_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `account_metrics_account_id_date_idx` ON `account_metrics` (`account_id`, `date`);
