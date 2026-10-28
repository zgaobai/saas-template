CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'info' NOT NULL,
	`link_url` text DEFAULT '' NOT NULL,
	`link_text` text DEFAULT '' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`dismissible` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `announcements_active_idx` ON `announcements` (`is_active`,`created_at`);
--> statement-breakpoint
CREATE TABLE `feedbacks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text REFERENCES `user`(`id`) ON DELETE SET NULL,
	`user_email` text NOT NULL,
	`type` text DEFAULT 'suggestion' NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`admin_notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feedbacks_status_idx` ON `feedbacks` (`status`,`created_at`);
