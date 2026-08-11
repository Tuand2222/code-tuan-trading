ALTER TABLE `trades` ADD `stop_loss` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trades` ADD `take_profit` real DEFAULT 0 NOT NULL;