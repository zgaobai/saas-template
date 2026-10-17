ALTER TABLE `ai_configs` ADD `text_models_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_configs` ADD `image_models_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_configs` ADD `video_models_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_configs` ADD `audio_models_json` text DEFAULT '[]' NOT NULL;
