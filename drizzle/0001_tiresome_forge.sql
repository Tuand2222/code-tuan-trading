CREATE TABLE `trade_images` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`trade_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trade_images_user_trade_idx` ON `trade_images` (`user_email`,`trade_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `trade_images_object_key_unique` ON `trade_images` (`object_key`);