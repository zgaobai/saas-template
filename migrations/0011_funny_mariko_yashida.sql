CREATE TABLE `credit_installments` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`user_id` text NOT NULL,
	`installment` integer NOT NULL,
	`credits` integer NOT NULL,
	`due_at` integer NOT NULL,
	`granted_at` integer,
	`canceled_at` integer,
	FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `installments_due_idx` ON `credit_installments` (`granted_at`,`canceled_at`,`due_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `installment_receipt_idx` ON `credit_installments` (`receipt_id`,`installment`);--> statement-breakpoint
CREATE TRIGGER installment_grant AFTER UPDATE OF granted_at ON credit_installments
WHEN OLD.granted_at IS NULL AND NEW.granted_at IS NOT NULL
BEGIN
 INSERT INTO credit_ledger(id,user_id,amount,reason,created_at)
 VALUES ('installment:'||NEW.id,NEW.user_id,NEW.credits,'年付订阅每月积分（第 '||NEW.installment||'/12 期）',NEW.granted_at);
 INSERT INTO credit_ledger(id,user_id,amount,reason,created_at)
 SELECT 'refund:installment:'||NEW.id,NEW.user_id,-(CAST((credits+NEW.credits)*refunded/amount AS INTEGER)-revoked),'部分退款调整当期积分',NEW.granted_at
 FROM receipts WHERE id=NEW.receipt_id AND refunded>0;
 UPDATE receipts SET revoked=CAST((credits+NEW.credits)*refunded/amount AS INTEGER),credits=credits+NEW.credits WHERE id=NEW.receipt_id;
END;
--> statement-breakpoint
CREATE TRIGGER installment_refund_cancel AFTER UPDATE OF refunded ON receipts
WHEN NEW.refunded>=NEW.amount
BEGIN
 UPDATE credit_installments SET canceled_at=CAST(strftime('%s','now') AS INTEGER)*1000 WHERE receipt_id=NEW.id AND granted_at IS NULL AND canceled_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER refunded_order_status AFTER UPDATE OF refunded ON receipts
WHEN NEW.refunded>=NEW.amount
BEGIN
 UPDATE orders SET status='refunded' WHERE id=NEW.order_id AND NOT EXISTS(SELECT 1 FROM receipts WHERE order_id=NEW.order_id AND refunded<amount);
END;
--> statement-breakpoint
CREATE UNIQUE INDEX one_pending_dynamic_subscription ON orders(user_id) WHERE payment_mode='subscription' AND status='pending';
