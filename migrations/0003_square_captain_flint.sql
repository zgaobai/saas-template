CREATE TABLE `maintenance_state` (
	`id` text PRIMARY KEY NOT NULL,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`started_at` integer DEFAULT 0 NOT NULL,
	`completed_at` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `request_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `files` ADD `status` text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE `files` ADD `updated_at` integer DEFAULT 0 NOT NULL;