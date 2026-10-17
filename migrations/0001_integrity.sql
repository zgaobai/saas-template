-- D1 executes each batch transactionally. Ledger insertion is the only balance mutation.
CREATE TRIGGER ledger_no_overdraft BEFORE INSERT ON credit_ledger
WHEN NEW.amount < 0 AND NEW.id NOT LIKE 'refund:%' AND (SELECT balance FROM wallets WHERE user_id=NEW.user_id) + NEW.amount < 0
BEGIN SELECT RAISE(ABORT, 'insufficient_credits'); END;
CREATE TRIGGER ledger_balance AFTER INSERT ON credit_ledger
BEGIN UPDATE wallets SET balance=balance+NEW.amount WHERE user_id=NEW.user_id; END;
CREATE UNIQUE INDEX one_pending_generation ON generations(user_id) WHERE status='pending';
CREATE UNIQUE INDEX one_pending_subscription_checkout ON orders(user_id) WHERE plan_id='creator' AND status='pending';
CREATE TRIGGER files_quota BEFORE INSERT ON files
WHEN (SELECT COUNT(*) FROM files WHERE user_id=NEW.user_id)>=100 OR (SELECT COALESCE(SUM(size),0) FROM files WHERE user_id=NEW.user_id)+NEW.size>104857600
BEGIN SELECT RAISE(ABORT, 'storage_quota_exceeded'); END;
ALTER TABLE receipts ADD COLUMN covered_until INTEGER NOT NULL DEFAULT 0;
CREATE TABLE refund_events (id TEXT PRIMARY KEY NOT NULL, receipt_id TEXT NOT NULL REFERENCES receipts(id), amount INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TRIGGER refund_bound BEFORE INSERT ON refund_events
WHEN NEW.amount<=0 OR (SELECT refunded+NEW.amount>amount FROM receipts WHERE id=NEW.receipt_id)
BEGIN SELECT RAISE(ABORT, 'invalid_refund_amount'); END;
CREATE TRIGGER refund_apply AFTER INSERT ON refund_events
BEGIN
 INSERT INTO credit_ledger (id,user_id,amount,reason,created_at)
 SELECT NEW.id,user_id,-(MIN(credits,CAST(credits*(refunded+NEW.amount)/amount AS INTEGER))-revoked),'退款撤回积分',NEW.created_at FROM receipts WHERE id=NEW.receipt_id;
 UPDATE receipts SET revoked=MIN(credits,CAST(credits*(refunded+NEW.amount)/amount AS INTEGER)),refunded=refunded+NEW.amount WHERE id=NEW.receipt_id;
 UPDATE orders SET status='refunded' WHERE id=(SELECT order_id FROM receipts WHERE id=NEW.receipt_id AND refunded=amount) AND plan_id='pack';
 UPDATE subscriptions SET paid_until=MIN(paid_until,NEW.created_at) WHERE order_id=(SELECT order_id FROM receipts WHERE id=NEW.receipt_id AND refunded=amount AND covered_until>=subscriptions.paid_until);
END;
