ALTER TABLE `broker_connections` ADD `webhook_token_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `connections_webhook_token_unique` ON `broker_connections` (`webhook_token_hash`);