CREATE TABLE `ai_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`base_url` text,
	`api_key_ciphertext` text,
	`api_key_hint` text,
	`api_style` text DEFAULT 'chat' NOT NULL,
	`text_model` text DEFAULT 'deepseek-ai/DeepSeek-V3' NOT NULL,
	`image_model` text,
	`video_model` text,
	`audio_model` text,
	`enabled` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
