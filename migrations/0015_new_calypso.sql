CREATE INDEX `orders_user_page_idx` ON `orders` (`user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `redemption_user_page_idx` ON `redemptions` (`user_id`,`created_at`,`id`);