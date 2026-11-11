ALTER TABLE `gifts` ADD `amount` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `homes` (
	`player_id` text PRIMARY KEY NOT NULL,
	`tier` integer DEFAULT 0 NOT NULL,
	`style` text,
	`layout` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL
);
