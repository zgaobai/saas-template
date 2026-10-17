ALTER TABLE `plan_configs` ADD `annual_price` integer;--> statement-breakpoint
ALTER TABLE `plan_configs` ADD `annual_payment_bindings` text DEFAULT '{}' NOT NULL;