-- Add token refresh tracking columns to threads_accounts
ALTER TABLE threads_accounts ADD COLUMN last_refresh_at integer;
ALTER TABLE threads_accounts ADD COLUMN refresh_failure_count integer NOT NULL DEFAULT 0;
ALTER TABLE threads_accounts ADD COLUMN refresh_error text;
