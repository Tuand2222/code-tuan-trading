CREATE TABLE `broker_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`provider` text NOT NULL,
	`label` text NOT NULL,
	`account_type` text DEFAULT 'default' NOT NULL,
	`credentials_ciphertext` text NOT NULL,
	`status` text DEFAULT 'configured' NOT NULL,
	`last_sync_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `connections_user_idx` ON `broker_connections` (`user_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `connections_user_provider_unique` ON `broker_connections` (`user_email`,`provider`,`label`);--> statement-breakpoint
CREATE TABLE `trades` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`external_id` text,
	`market` text NOT NULL,
	`source` text DEFAULT 'Thủ công' NOT NULL,
	`account_id` text,
	`date` text NOT NULL,
	`symbol` text NOT NULL,
	`side` text NOT NULL,
	`session` text NOT NULL,
	`setup` text NOT NULL,
	`timeframe` text NOT NULL,
	`risk` real DEFAULT 0 NOT NULL,
	`pnl` real DEFAULT 0 NOT NULL,
	`fees` real DEFAULT 0 NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`entry_price` real DEFAULT 0 NOT NULL,
	`exit_price` real DEFAULT 0 NOT NULL,
	`discipline` integer DEFAULT 100 NOT NULL,
	`psychology` text DEFAULT 'Đồng bộ' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`duration_min` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trades_user_date_idx` ON `trades` (`user_email`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `trades_external_unique` ON `trades` (`user_email`,`source`,`external_id`);