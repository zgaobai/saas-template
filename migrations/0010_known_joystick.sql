ALTER TABLE `orders` ADD `payment_mode` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `billing_interval` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `product_ref` text;--> statement-breakpoint
ALTER TABLE `plan_configs` ADD `billing_interval` text;--> statement-breakpoint
ALTER TABLE `plan_configs` ADD `payment_bindings` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
UPDATE plan_configs SET billing_interval='month' WHERE mode='subscription';
--> statement-breakpoint
UPDATE orders SET payment_mode=CASE WHEN plan_id='creator' THEN 'subscription' ELSE 'payment' END, billing_interval=CASE WHEN plan_id='creator' THEN 'month' ELSE NULL END;
