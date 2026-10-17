ALTER TABLE `redeem_codes` ADD `term_months` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER redemption_term_valid BEFORE INSERT ON redemptions
WHEN (SELECT term_months FROM redeem_codes WHERE id=NEW.code_id)>0
BEGIN
 SELECT CASE WHEN NEW.starts_at<NEW.created_at OR NEW.plan_id IS NULL OR NEW.grant_months != (SELECT term_months FROM redeem_codes WHERE id=NEW.code_id) THEN RAISE(ABORT,'invalid_redemption_term') END;
END;
--> statement-breakpoint
CREATE TRIGGER redemption_month_term AFTER INSERT ON redemptions
WHEN (SELECT term_months FROM redeem_codes WHERE id=NEW.code_id)=1
BEGIN
 UPDATE redemptions SET expires_at=(CAST(strftime('%s',date(NEW.starts_at/1000,'unixepoch','start of month','+'||(1)||' months')) AS INTEGER)*1000+(MIN(CAST(strftime('%d',NEW.starts_at/1000,'unixepoch') AS INTEGER),CAST(strftime('%d',date(date(NEW.starts_at/1000,'unixepoch','start of month','+'||(1)||' months'),'+1 month','-1 day')) AS INTEGER))-1)*86400000+NEW.starts_at%86400000) WHERE id=NEW.id ;
END;
