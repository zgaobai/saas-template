CREATE TABLE `plan_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mode` text NOT NULL,
	`price` integer NOT NULL,
	`credits` integer NOT NULL,
	`description` text NOT NULL,
	`features` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `redeem_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`hint` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`plan_id` text,
	`plan_name` text,
	`credits` integer NOT NULL,
	`days` integer DEFAULT 0 NOT NULL,
	`max_uses` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`disabled_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `redeem_codes_code_hash_unique` ON `redeem_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `redeem_codes_time_idx` ON `redeem_codes` (`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`code_id` text NOT NULL,
	`user_id` text NOT NULL,
	`credits` integer NOT NULL,
	`plan_id` text,
	`plan_name` text,
	`expires_at` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`code_id`) REFERENCES `redeem_codes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `redemption_once_idx` ON `redemptions` (`code_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `redemption_user_time_idx` ON `redemptions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `redemption_time_idx` ON `redemptions` (`created_at`,`id`);--> statement-breakpoint
ALTER TABLE `generations` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `generations` ADD `error_code` text;--> statement-breakpoint
CREATE INDEX `admin_tasks_time_idx` ON `generations` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `admin_tasks_status_time_idx` ON `generations` (`status`,`created_at`,`id`);--> statement-breakpoint
ALTER TABLE `orders` ADD `plan_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `disabled_at` integer;--> statement-breakpoint
CREATE INDEX `admin_ledger_time_idx` ON `credit_ledger` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `receipts_time_idx` ON `receipts` (`created_at`);--> statement-breakpoint
CREATE INDEX `refund_events_time_idx` ON `refund_events` (`created_at`);--> statement-breakpoint
INSERT INTO plan_configs(id,name,mode,price,credits,description,features,enabled,revision,updated_at) VALUES
('starter','体验版','free',0,20,'从第一个想法开始','["AI 文案生成","六款文字工具"]',1,1,0),
('creator','创作者','subscription',1900,500,'为持续创作留出空间','["完整生成能力","可随时取消后续续费"]',1,1,0),
('pack','灵感补给','payment',900,200,'需要时再多一点额度','["不自动续费","与已有积分叠加使用"]',1,1,0);
--> statement-breakpoint
CREATE TRIGGER disabled_session_insert BEFORE INSERT ON session
WHEN (SELECT disabled_at FROM user WHERE id=NEW.user_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT,'account_disabled'); END;
--> statement-breakpoint
CREATE TRIGGER disabled_session_update BEFORE UPDATE ON session
WHEN (SELECT disabled_at FROM user WHERE id=NEW.user_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT,'account_disabled'); END;
--> statement-breakpoint
CREATE TRIGGER disabled_generation_insert BEFORE INSERT ON generations
WHEN (SELECT disabled_at FROM user WHERE id=NEW.user_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT,'account_disabled'); END;
--> statement-breakpoint
CREATE TRIGGER disabled_order_insert BEFORE INSERT ON orders
WHEN (SELECT disabled_at FROM user WHERE id=NEW.user_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT,'account_disabled'); END;
--> statement-breakpoint
CREATE TRIGGER redemption_valid BEFORE INSERT ON redemptions
WHEN NOT EXISTS (SELECT 1 FROM redemptions WHERE code_id=NEW.code_id AND user_id=NEW.user_id)
BEGIN
 SELECT CASE WHEN NOT EXISTS (
   SELECT 1 FROM redeem_codes c JOIN user u ON u.id=NEW.user_id
   WHERE c.id=NEW.code_id AND c.disabled_at IS NULL AND c.expires_at>NEW.created_at AND c.used<c.max_uses
   AND c.credits=NEW.credits AND c.plan_id IS NEW.plan_id AND c.plan_name IS NEW.plan_name
   AND u.closed_at IS NULL AND u.disabled_at IS NULL
 ) THEN RAISE(ABORT,'redemption_unavailable') END;
END;
--> statement-breakpoint
CREATE TRIGGER redemption_apply AFTER INSERT ON redemptions
BEGIN
 UPDATE redeem_codes SET used=used+1 WHERE id=NEW.code_id;
 INSERT INTO wallets(user_id,balance) VALUES (NEW.user_id,0) ON CONFLICT(user_id) DO NOTHING;
 INSERT INTO credit_ledger(id,user_id,amount,reason,created_at) VALUES ('redeem:'||NEW.id,NEW.user_id,NEW.credits,'兑换码兑换：'||COALESCE(NEW.plan_name,'积分'),NEW.created_at);
 INSERT INTO audit_logs(id,actor_id,action,target_id,created_at) VALUES ('redeem:'||NEW.id,NEW.user_id,'code.redeemed:'||NEW.code_id,NEW.user_id,NEW.created_at);
END;
