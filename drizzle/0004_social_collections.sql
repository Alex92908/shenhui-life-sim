ALTER TABLE `players` ADD `employer` text DEFAULT 'startup' NOT NULL;
--> statement-breakpoint
ALTER TABLE `players` ADD `stamps` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `players` ADD `title` text;
--> statement-breakpoint
CREATE TABLE `gifts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_id` text NOT NULL,
	`from_name` text NOT NULL,
	`to_id` text NOT NULL,
	`kind` text NOT NULL,
	`company` text,
	`claimed` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `gifts_to_idx` ON `gifts` (`to_id`,`claimed`);
