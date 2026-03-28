-- Add deduplication and replay protection columns to webhook_events
ALTER TABLE webhook_events ADD COLUMN meta_event_id text;
--> statement-breakpoint
ALTER TABLE webhook_events ADD COLUMN received_at integer;
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_events_meta_event_id_idx` ON `webhook_events` (`meta_event_id`);
