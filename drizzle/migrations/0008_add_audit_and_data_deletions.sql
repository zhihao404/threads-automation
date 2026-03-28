CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`before_state` text,
	`after_state` text,
	`metadata` text,
	`ip_address` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_events_action_idx` ON `audit_events` (`action`);
--> statement-breakpoint
CREATE INDEX `audit_events_resource_idx` ON `audit_events` (`resource_type`, `resource_id`);
--> statement-breakpoint
CREATE INDEX `audit_events_actor_idx` ON `audit_events` (`actor_id`);
--> statement-breakpoint
CREATE INDEX `audit_events_created_at_idx` ON `audit_events` (`created_at`);
--> statement-breakpoint
CREATE TABLE `data_deletions` (
	`id` text PRIMARY KEY NOT NULL,
	`threads_user_id` text NOT NULL,
	`confirmation_code` text NOT NULL,
	`status` text NOT NULL,
	`tables_deleted` text,
	`error_message` text,
	`requested_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `data_deletions_user_idx` ON `data_deletions` (`threads_user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `data_deletions_confirmation_idx` ON `data_deletions` (`confirmation_code`);
