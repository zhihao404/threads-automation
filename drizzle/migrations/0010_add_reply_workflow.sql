CREATE TABLE `inbox_items` (
	`id` text PRIMARY KEY NOT NULL,
	`threads_account_id` text NOT NULL,
	`threads_post_id` text NOT NULL,
	`threads_reply_id` text NOT NULL,
	`reply_username` text NOT NULL,
	`reply_text` text NOT NULL,
	`reply_media_url` text,
	`reply_timestamp` integer NOT NULL,
	`item_type` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`threads_account_id`) REFERENCES `threads_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inbox_items_account_idx` ON `inbox_items` (`threads_account_id`);
--> statement-breakpoint
CREATE INDEX `inbox_items_status_idx` ON `inbox_items` (`status`);
--> statement-breakpoint
CREATE INDEX `inbox_items_timestamp_idx` ON `inbox_items` (`reply_timestamp`);
--> statement-breakpoint
CREATE UNIQUE INDEX `inbox_items_reply_id_idx` ON `inbox_items` (`threads_reply_id`);
--> statement-breakpoint
CREATE TABLE `reply_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`inbox_item_id` text NOT NULL,
	`content` text NOT NULL,
	`generated_by` text NOT NULL,
	`ai_model` text,
	`ai_prompt` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`inbox_item_id`) REFERENCES `inbox_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reply_drafts_inbox_item_idx` ON `reply_drafts` (`inbox_item_id`);
--> statement-breakpoint
CREATE TABLE `reply_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`inbox_item_id` text NOT NULL,
	`reply_draft_id` text,
	`decision` text NOT NULL,
	`decided_by` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`inbox_item_id`) REFERENCES `inbox_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reply_draft_id`) REFERENCES `reply_drafts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reply_decisions_inbox_item_idx` ON `reply_decisions` (`inbox_item_id`);
--> statement-breakpoint
CREATE INDEX `reply_decisions_decided_by_idx` ON `reply_decisions` (`decided_by`);
