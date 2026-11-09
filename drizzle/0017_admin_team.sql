CREATE TABLE `admin_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`role` text DEFAULT 'ops' NOT NULL,
	`disabled` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_token_idx` ON `admin_users` (`token_hash`);
--> statement-breakpoint
CREATE TABLE `admin_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin` text NOT NULL,
	`action` text NOT NULL,
	`target` text,
	`detail` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `players` ADD `muted_until` integer;
