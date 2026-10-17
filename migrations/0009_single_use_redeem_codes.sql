ALTER TABLE `redeem_codes` ADD `code_ciphertext` text;
--> statement-breakpoint
CREATE TRIGGER redemption_single_use BEFORE INSERT ON redemptions
WHEN EXISTS (SELECT 1 FROM redemptions WHERE code_id=NEW.code_id)
  OR EXISTS (SELECT 1 FROM redeem_codes WHERE id=NEW.code_id AND used>=1)
BEGIN SELECT RAISE(ABORT,'redemption_already_used'); END;
