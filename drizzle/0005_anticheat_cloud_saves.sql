ALTER TABLE `players` ADD `suspect` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `cloud_saves` (
	`player_id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`save` text NOT NULL,
	`meta` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cloud_saves_secret_idx` ON `cloud_saves` (`secret`);
