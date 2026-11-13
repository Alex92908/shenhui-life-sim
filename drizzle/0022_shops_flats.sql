CREATE TABLE `shops` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`owner_pub` text,
	`owner_name` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`loc_id` text NOT NULL,
	`city_key` text NOT NULL,
	`lvl` integer NOT NULL DEFAULT 1,
	`floor` integer NOT NULL DEFAULT 1,
	`building` text,
	`till` integer NOT NULL DEFAULT 0,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `homes` ADD COLUMN `name` text;
--> statement-breakpoint
ALTER TABLE `homes` ADD COLUMN `loc_id` text;
--> statement-breakpoint
ALTER TABLE `homes` ADD COLUMN `city_key` text;
