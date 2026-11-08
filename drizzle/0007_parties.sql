CREATE TABLE `parties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`host_id` text NOT NULL,
	`host_name` text NOT NULL,
	`city_key` text NOT NULL,
	`loc_id` text NOT NULL,
	`loc_name` text NOT NULL,
	`activity_id` text NOT NULL,
	`members` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer
);
--> statement-breakpoint
CREATE INDEX `parties_city_idx` ON `parties` (`city_key`,`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `buddies` (
	`a` text NOT NULL,
	`b` text NOT NULL,
	`n` integer DEFAULT 0 NOT NULL,
	`last_at` integer NOT NULL,
	PRIMARY KEY(`a`, `b`)
);
