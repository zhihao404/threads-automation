CREATE TABLE `publish_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`container_id` text,
	`status` text NOT NULL,
	`attempt_number` integer DEFAULT 1 NOT NULL,
	`error_message` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `publish_attempts_post_id_idx` ON `publish_attempts` (`post_id`);
--> statement-breakpoint
CREATE INDEX `publish_attempts_status_idx` ON `publish_attempts` (`status`);
