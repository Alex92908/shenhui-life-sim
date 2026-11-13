CREATE TABLE `trade_dispute_votes` (
	`task_id` integer NOT NULL,
	`voter_id` text NOT NULL,
	`side` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`task_id`, `voter_id`)
);
--> statement-breakpoint
ALTER TABLE `trade_tasks` ADD COLUMN `disputed_at` integer;
--> statement-breakpoint
ALTER TABLE `trade_tasks` ADD COLUMN `dispute_from_status` text;
--> statement-breakpoint
ALTER TABLE `trade_tasks` ADD COLUMN `dispute_verdict` text;
--> statement-breakpoint
ALTER TABLE `trade_tasks` ADD COLUMN `dispute_settled_at` integer;
--> statement-breakpoint
CREATE TABLE `patrols` (
	`officer_id` text PRIMARY KEY NOT NULL,
	`city` text NOT NULL,
	`started_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `patrol_watches` (
	`officer_id` text NOT NULL,
	`target_id` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`city` text NOT NULL,
	`started_at` integer NOT NULL,
	PRIMARY KEY(`officer_id`, `target_id`)
);
--> statement-breakpoint
CREATE TABLE `livehouse_tips` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`track_id` integer NOT NULL,
	`tipper_id` text NOT NULL,
	`tipper_name` text NOT NULL,
	`creator_id` text NOT NULL,
	`amount` integer NOT NULL,
	`creator_share` integer NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`host_id` text NOT NULL,
	`host_name` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`restaurant_name` text NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_order_members` (
	`group_id` integer NOT NULL,
	`player_id` text NOT NULL,
	`player_name` text NOT NULL,
	`items_json` text DEFAULT '[]' NOT NULL,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`group_id`, `player_id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_quests` (
	`player_id` text NOT NULL,
	`week_key` text NOT NULL,
	`quest_id` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`claimed` integer DEFAULT 0 NOT NULL,
	`meta` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`player_id`, `week_key`, `quest_id`)
);
