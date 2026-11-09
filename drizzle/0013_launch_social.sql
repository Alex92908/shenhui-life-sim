CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`city` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feedback_created_idx` ON `feedback` (`created_at`);
--> statement-breakpoint
CREATE TABLE `bonds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`a` text NOT NULL,
	`b` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bonds_a_idx` ON `bonds` (`a`, `status`);
--> statement-breakpoint
CREATE INDEX `bonds_b_idx` ON `bonds` (`b`, `status`);
--> statement-breakpoint
CREATE TABLE `committee_candidates` (
	`week` integer NOT NULL,
	`city` text NOT NULL,
	`player_id` text NOT NULL,
	`pledge` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`week`, `city`, `player_id`)
);
--> statement-breakpoint
CREATE TABLE `committee_votes` (
	`week` integer NOT NULL,
	`city` text NOT NULL,
	`voter_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`week`, `city`, `voter_id`)
);
--> statement-breakpoint
CREATE INDEX `committee_votes_cand_idx` ON `committee_votes` (`week`, `city`, `candidate_id`);
