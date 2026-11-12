CREATE TABLE `group_order_escrow` (
	`group_id` integer NOT NULL,
	`player_id` text NOT NULL,
	`food_amount` integer NOT NULL,
	`fee_amount` integer NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'held' NOT NULL,
	`created_at` integer NOT NULL,
	`released_at` integer,
	PRIMARY KEY(`group_id`, `player_id`)
);
--> statement-breakpoint
ALTER TABLE `group_orders` ADD COLUMN `pool_id` text;
--> statement-breakpoint
ALTER TABLE `group_orders` ADD COLUMN `locked_at` integer;
