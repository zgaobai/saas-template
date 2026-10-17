CREATE TABLE `redemption_installments` (
	`id` text PRIMARY KEY NOT NULL,
	`redemption_id` text NOT NULL,
	`user_id` text NOT NULL,
	`installment` integer NOT NULL,
	`credits` integer NOT NULL,
	`due_at` integer NOT NULL,
	`granted_at` integer,
	FOREIGN KEY (`redemption_id`) REFERENCES `redemptions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `redemption_installment_once_idx` ON `redemption_installments` (`redemption_id`,`installment`);--> statement-breakpoint
CREATE INDEX `redemption_installments_due_idx` ON `redemption_installments` (`granted_at`,`due_at`);--> statement-breakpoint
CREATE INDEX `redemption_installments_user_due_idx` ON `redemption_installments` (`user_id`,`granted_at`,`due_at`);--> statement-breakpoint
ALTER TABLE `redeem_codes` ADD `grant_months` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `redemptions` ADD `grant_months` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `redemptions` ADD `starts_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `installments_user_due_idx` ON `credit_installments` (`user_id`,`granted_at`,`canceled_at`,`due_at`);
--> statement-breakpoint
UPDATE redeem_codes SET grant_months=12,days=0 WHERE used=0 AND kind='plan' AND plan_id IN (SELECT id FROM plan_configs WHERE mode='subscription' AND billing_interval='year');
--> statement-breakpoint
CREATE TRIGGER redemption_schedule_valid BEFORE INSERT ON redemptions
BEGIN
 SELECT CASE WHEN NEW.grant_months NOT IN (1,12) OR NEW.grant_months != (SELECT grant_months FROM redeem_codes WHERE id=NEW.code_id) OR (NEW.grant_months=12 AND (NEW.plan_id IS NULL OR NEW.starts_at<NEW.created_at)) THEN RAISE(ABORT,'invalid_redemption_schedule') END;
END;
--> statement-breakpoint
DROP TRIGGER redemption_apply;
--> statement-breakpoint
CREATE TRIGGER redemption_apply AFTER INSERT ON redemptions
BEGIN
 UPDATE redeem_codes SET used=used+1 WHERE id=NEW.code_id;
 INSERT INTO wallets(user_id,balance) VALUES (NEW.user_id,0) ON CONFLICT(user_id) DO NOTHING;
 INSERT INTO credit_ledger(id,user_id,amount,reason,created_at)
 SELECT 'redeem:'||NEW.id,NEW.user_id,NEW.credits,'兑换码兑换：'||COALESCE(NEW.plan_name,'积分'),NEW.created_at WHERE NEW.grant_months=1;
 INSERT INTO audit_logs(id,actor_id,action,target_id,created_at) VALUES ('redeem:'||NEW.id,NEW.user_id,'code.redeemed:'||NEW.code_id,NEW.user_id,NEW.created_at);
 UPDATE redemptions SET expires_at=(CAST(strftime('%s',date(NEW.starts_at/1000,'unixepoch','start of month','+'||(12)||' months')) AS INTEGER)*1000+(MIN(CAST(strftime('%d',NEW.starts_at/1000,'unixepoch') AS INTEGER),CAST(strftime('%d',date(date(NEW.starts_at/1000,'unixepoch','start of month','+'||(12)||' months'),'+1 month','-1 day')) AS INTEGER))-1)*86400000+NEW.starts_at%86400000) WHERE id=NEW.id AND NEW.grant_months=12;
 INSERT INTO redemption_installments(id,redemption_id,user_id,installment,credits,due_at)
 SELECT NEW.id||':'||(n+1),NEW.id,NEW.user_id,n+1,NEW.credits,(CAST(strftime('%s',date(NEW.starts_at/1000,'unixepoch','start of month','+'||(n)||' months')) AS INTEGER)*1000+(MIN(CAST(strftime('%d',NEW.starts_at/1000,'unixepoch') AS INTEGER),CAST(strftime('%d',date(date(NEW.starts_at/1000,'unixepoch','start of month','+'||(n)||' months'),'+1 month','-1 day')) AS INTEGER))-1)*86400000+NEW.starts_at%86400000)
 FROM (SELECT value AS n FROM json_each('[0,1,2,3,4,5,6,7,8,9,10,11]')) WHERE NEW.grant_months=12;
 UPDATE redemption_installments SET granted_at=NEW.created_at WHERE redemption_id=NEW.id AND due_at<=NEW.created_at AND granted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER redemption_installment_grant AFTER UPDATE OF granted_at ON redemption_installments
WHEN OLD.granted_at IS NULL AND NEW.granted_at IS NOT NULL
BEGIN
 INSERT INTO credit_ledger(id,user_id,amount,reason,created_at)
 VALUES ('redeem-month:'||NEW.id,NEW.user_id,NEW.credits,'年付套餐兑换每月积分（第 '||NEW.installment||'/12 期）',NEW.granted_at);
END;
