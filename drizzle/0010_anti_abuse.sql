ALTER TABLE `players` ADD `device` text;
--> statement-breakpoint
ALTER TABLE `players` ADD `ip_hash` text;
--> statement-breakpoint
ALTER TABLE `players` ADD `ip_group` text;
--> statement-breakpoint
ALTER TABLE `players` ADD `active_days` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `players` ADD `last_active_day` text;
--> statement-breakpoint
CREATE INDEX `players_device_idx` ON `players` (`device`);
--> statement-breakpoint
CREATE TABLE `invites` (
	`invitee_id` text PRIMARY KEY NOT NULL,
	`inviter_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	`decided_at` integer
);
--> statement-breakpoint
CREATE INDEX `invites_inviter_idx` ON `invites` (`inviter_id`,`status`);
--> statement-breakpoint
CREATE TABLE `reward_claims` (
	`player_id` text NOT NULL,
	`kind` text NOT NULL,
	`day` text NOT NULL,
	`n` integer DEFAULT 1 NOT NULL,
	`money` integer DEFAULT 0 NOT NULL,
	`device` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`player_id`, `kind`, `day`)
);
--> statement-breakpoint
CREATE INDEX `reward_claims_device_idx` ON `reward_claims` (`device`,`kind`,`day`);
