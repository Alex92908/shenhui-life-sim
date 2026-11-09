CREATE TABLE `music_tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`artist` text NOT NULL,
	`title` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`duration_sec` integer NOT NULL,
	`chunks` integer NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`boost_until` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `music_tracks_status_idx` ON `music_tracks` (`status`);
--> statement-breakpoint
CREATE TABLE `music_chunks` (
	`track_id` integer NOT NULL,
	`idx` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`track_id`, `idx`)
);
