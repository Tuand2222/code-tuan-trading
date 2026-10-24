CREATE TABLE `classic_archive_queue` (
	`owner_id` text NOT NULL,
	`record_key` text NOT NULL,
	`token` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classic_archive_queue_owner_key` ON `classic_archive_queue` (`owner_id`,`record_key`);
--> statement-breakpoint
CREATE TRIGGER archive_trade_insert AFTER INSERT ON trades WHEN NEW.user_id IS NOT NULL BEGIN
 INSERT INTO classic_archive_queue(owner_id,record_key,token,updated_at) VALUES(NEW.user_id,'trade:'||NEW.id,lower(hex(randomblob(16))),CURRENT_TIMESTAMP)
 ON CONFLICT(owner_id,record_key) DO UPDATE SET token=excluded.token,updated_at=excluded.updated_at;
END;

--> statement-breakpoint
CREATE TRIGGER archive_trade_update AFTER UPDATE ON trades WHEN NEW.user_id IS NOT NULL BEGIN
 INSERT INTO classic_archive_queue(owner_id,record_key,token,updated_at) VALUES(NEW.user_id,'trade:'||NEW.id,lower(hex(randomblob(16))),CURRENT_TIMESTAMP)
 ON CONFLICT(owner_id,record_key) DO UPDATE SET token=excluded.token,updated_at=excluded.updated_at;
END;

--> statement-breakpoint
CREATE TRIGGER archive_image_insert AFTER INSERT ON trade_images WHEN NEW.user_id IS NOT NULL BEGIN
 INSERT INTO classic_archive_queue(owner_id,record_key,token,updated_at) VALUES(NEW.user_id,'image:'||NEW.id,lower(hex(randomblob(16))),CURRENT_TIMESTAMP)
 ON CONFLICT(owner_id,record_key) DO UPDATE SET token=excluded.token,updated_at=excluded.updated_at;
END;

--> statement-breakpoint
CREATE TRIGGER archive_image_delete AFTER DELETE ON trade_images WHEN OLD.user_id IS NOT NULL BEGIN
 INSERT INTO classic_archive_queue(owner_id,record_key,token,updated_at) VALUES(OLD.user_id,'image:'||OLD.id,lower(hex(randomblob(16))),CURRENT_TIMESTAMP)
 ON CONFLICT(owner_id,record_key) DO UPDATE SET token=excluded.token,updated_at=excluded.updated_at;
END;
