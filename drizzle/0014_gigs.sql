CREATE TABLE `gigs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`employer_id` text NOT NULL,
	`worker_id` text,
	`title` text NOT NULL,
	`pay` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	`taken_at` integer,
	`delivered_at` integer,
	`due_at` integer,
	`worker_claimed` integer DEFAULT 0 NOT NULL,
	`employer_claimed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `gigs_city_status_idx` ON `gigs` (`city`, `status`);
--> statement-breakpoint
CREATE INDEX `gigs_employer_idx` ON `gigs` (`employer_id`);
--> statement-breakpoint
CREATE INDEX `gigs_worker_idx` ON `gigs` (`worker_id`);
--> statement-breakpoint
CREATE TABLE `gig_votes` (
	`gig_id` integer NOT NULL,
	`voter_id` text NOT NULL,
	`side` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`gig_id`, `voter_id`)
);
