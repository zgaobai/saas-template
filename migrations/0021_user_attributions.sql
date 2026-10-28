CREATE TABLE `user_attributions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`channel` text NOT NULL DEFAULT 'direct',
	`source` text,
	`medium` text,
	`campaign` text,
	`content` text,
	`term` text,
	`ref_code` text,
	`landing_path` text,
	`referrer_url` text,
	`created_at` integer NOT NULL
);
CREATE UNIQUE INDEX `user_attribution_user_idx` ON `user_attributions` (`user_id`);
CREATE INDEX `user_attribution_channel_idx` ON `user_attributions` (`channel`, `created_at`);
