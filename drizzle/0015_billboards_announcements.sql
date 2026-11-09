CREATE TABLE `billboards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`slot` integer NOT NULL,
	`account_id` text,
	`owner` text NOT NULL,
	`text` text NOT NULL,
	`emoji` text NOT NULL,
	`ends_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `billboards_city_idx` ON `billboards` (`city`, `ends_at`);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`zh` text NOT NULL,
	`en` text NOT NULL,
	`created_at` integer NOT NULL
);
