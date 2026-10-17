ALTER TABLE `user` ADD `closed_at` integer;
--> statement-breakpoint
CREATE TRIGGER closed_user_session_insert BEFORE INSERT ON session
WHEN (SELECT closed_at FROM user WHERE id=NEW.user_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'Account is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_user_account_insert BEFORE INSERT ON account
WHEN (SELECT closed_at FROM user WHERE id=NEW.user_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'Account is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_user_orders_insert BEFORE INSERT ON orders
WHEN (SELECT closed_at FROM user WHERE id=NEW.user_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'Account is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_user_generations_insert BEFORE INSERT ON generations
WHEN (SELECT closed_at FROM user WHERE id=NEW.user_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'Account is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_user_files_insert BEFORE INSERT ON files
WHEN (SELECT closed_at FROM user WHERE id=NEW.user_id) IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'Account is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_user_subscription_insert BEFORE INSERT ON subscriptions
WHEN (SELECT closed_at FROM user WHERE id=NEW.user_id) IS NOT NULL
AND UPPER(NEW.status) NOT IN ('CANCELED','MERCHANT_CANCELLED','USER_CANCELLED','CHANNEL_CANCELLED','CLOSE','EXPIRED')
BEGIN SELECT RAISE(ABORT, 'Closed account cannot have a renewable subscription'); END;
--> statement-breakpoint
CREATE TRIGGER closed_user_subscription_update BEFORE UPDATE ON subscriptions
WHEN (SELECT closed_at FROM user WHERE id=NEW.user_id) IS NOT NULL
AND UPPER(NEW.status) NOT IN ('CANCELED','MERCHANT_CANCELLED','USER_CANCELLED','CHANNEL_CANCELLED','CLOSE','EXPIRED')
BEGIN SELECT RAISE(ABORT, 'Closed account cannot have a renewable subscription'); END;
