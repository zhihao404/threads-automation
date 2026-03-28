CREATE TABLE `profile_api_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`threads_account_id` text NOT NULL,
	`action_type` text NOT NULL,
	`timestamp` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`threads_account_id`) REFERENCES `threads_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `profile_api_usage_account_action_idx` ON `profile_api_usage` (`threads_account_id`, `action_type`);
--> statement-breakpoint
CREATE INDEX `profile_api_usage_timestamp_idx` ON `profile_api_usage` (`timestamp`);
