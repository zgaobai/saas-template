ALTER TABLE `generations` ADD `model` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `generations` ADD `prompt_tokens` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `generations` ADD `completion_tokens` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `generations` ADD `total_tokens` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `generations` ADD `cost_micros` integer DEFAULT 0 NOT NULL;
