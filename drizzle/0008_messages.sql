CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`body` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `messages_to_idx` ON `messages` (`to_id`,`id`);
--> statement-breakpoint
CREATE INDEX `messages_from_idx` ON `messages` (`from_id`,`id`);
--> statement-breakpoint
CREATE TABLE `blocks` (
	`a` text NOT NULL,
	`b` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`a`, `b`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reporter_id` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`context` text,
	`created_at` integer NOT NULL
);
