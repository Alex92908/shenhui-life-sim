ALTER TABLE `players` ADD `pub` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `players_pub_idx` ON `players` (`pub`);
--> statement-breakpoint
CREATE INDEX `players_last_seen_idx` ON `players` (`last_seen`);
--> statement-breakpoint
CREATE INDEX `players_money_idx` ON `players` (`suspect`,`money`);
--> statement-breakpoint
CREATE INDEX `players_stamps_idx` ON `players` (`suspect`,`stamps`);
--> statement-breakpoint
CREATE INDEX `chat_city_idx` ON `chat_messages` (`city_key`,`id`);
--> statement-breakpoint
CREATE INDEX `chat_player_time_idx` ON `chat_messages` (`player_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `feed_player_time_idx` ON `feed_events` (`player_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `gifts_from_time_idx` ON `gifts` (`from_id`,`created_at`);
