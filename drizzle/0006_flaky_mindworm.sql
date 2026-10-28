CREATE TABLE `journal_cloud_heads` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`mutation_id` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `journal_cloud_records` (
	`owner_id` text NOT NULL,
	`record_key` text NOT NULL,
	`collection` text NOT NULL,
	`record_id` text NOT NULL,
	`period` text,
	`revision` integer NOT NULL,
	`hash` text NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	`object_key` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journal_cloud_owner_key` ON `journal_cloud_records` (`owner_id`,`record_key`);--> statement-breakpoint
CREATE INDEX `journal_cloud_owner_period` ON `journal_cloud_records` (`owner_id`,`period`,`record_key`);--> statement-breakpoint
CREATE TABLE `journal_cloud_versions` (
	`owner_id` text NOT NULL,
	`record_key` text NOT NULL,
	`revision` integer NOT NULL,
	`hash` text NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	`object_key` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journal_cloud_version_unique` ON `journal_cloud_versions` (`owner_id`,`record_key`,`revision`);