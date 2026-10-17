CREATE INDEX `admin_audit_time_idx` ON `audit_logs` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `admin_orders_time_idx` ON `orders` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `admin_orders_status_time_idx` ON `orders` (`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `admin_subscriptions_time_idx` ON `subscriptions` (`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `admin_subscriptions_status_time_idx` ON `subscriptions` (`status`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `admin_users_time_idx` ON `user` (`created_at`,`id`);