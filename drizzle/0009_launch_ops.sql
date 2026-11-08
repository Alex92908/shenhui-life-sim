ALTER TABLE `players` ADD `banned` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `players` ADD `season` text DEFAULT '2026-11' NOT NULL;
--> statement-breakpoint
ALTER TABLE `reports` ADD `status` text DEFAULT 'open' NOT NULL;
--> statement-breakpoint
ALTER TABLE `reports` ADD `resolved_at` integer;
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player` text NOT NULL,
	`name` text NOT NULL,
	`props` text,
	`day` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_day_idx` ON `events` (`day`,`name`);
--> statement-breakpoint
CREATE INDEX `events_player_idx` ON `events` (`player`,`day`);
--> statement-breakpoint
CREATE TABLE `client_errors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player` text,
	`message` text NOT NULL,
	`stack` text,
	`url` text,
	`ua` text,
	`count` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`last_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `client_errors_msg_idx` ON `client_errors` (`message`);
