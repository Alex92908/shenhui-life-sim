CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `identities` (
	`provider` text NOT NULL,
	`subject` text NOT NULL,
	`account_id` text NOT NULL,
	`verified_at` integer NOT NULL,
	PRIMARY KEY(`provider`, `subject`)
);
--> statement-breakpoint
CREATE INDEX `identities_account_idx` ON `identities` (`account_id`);
--> statement-breakpoint
CREATE TABLE `login_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`subject` text NOT NULL,
	`code_hash` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`ip_hash` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`used_at` integer
);
--> statement-breakpoint
CREATE INDEX `login_codes_subject_idx` ON `login_codes` (`provider`,`subject`,`created_at`);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`device` text,
	`created_at` integer NOT NULL,
	`last_used_at` integer NOT NULL,
	`revoked_at` integer
);
--> statement-breakpoint
ALTER TABLE `players` ADD `account_id` text;
