CREATE TABLE `strays` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`kind` text NOT NULL,
	`appearance` text NOT NULL,
	`temper` text NOT NULL,
	`loc_id` text NOT NULL,
	`loc_name` text NOT NULL,
	`x` real DEFAULT 0 NOT NULL,
	`z` real DEFAULT 0 NOT NULL,
	`trust` integer DEFAULT 0 NOT NULL,
	`last_fed_day` integer DEFAULT -1 NOT NULL,
	`first_seen_day` integer DEFAULT 1 NOT NULL,
	`adopted` integer DEFAULT 0 NOT NULL,
	`fed_by_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stray_feeds` (
	`stray_id` integer NOT NULL,
	`player_id` text NOT NULL,
	`day` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`stray_id`, `player_id`, `day`)
);
--> statement-breakpoint
CREATE TABLE `player_pets` (
	`player_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`loc_id` text NOT NULL,
	`loc_name` text NOT NULL,
	`x` real,
	`z` real,
	`photo_url` text,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`expires_at` integer NOT NULL,
	`claimed_by_name` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notice_replies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notice_id` integer NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snake_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`loc_id` text NOT NULL,
	`loc_name` text NOT NULL,
	`x` real,
	`z` real,
	`species_guess` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`photo_url` text,
	`reporter_id` text NOT NULL,
	`reporter_name` text NOT NULL,
	`expires_at` integer NOT NULL,
	`confirmations` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snake_confirms` (
	`report_id` integer NOT NULL,
	`player_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`report_id`, `player_id`)
);
--> statement-breakpoint
CREATE TABLE `fishing_spots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`loc_id` text NOT NULL,
	`loc_name` text NOT NULL,
	`x` real,
	`z` real,
	`catch_desc` text NOT NULL,
	`bait` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`photo_url` text,
	`reporter_id` text NOT NULL,
	`reporter_name` text NOT NULL,
	`confirmations` integer DEFAULT 0 NOT NULL,
	`last_confirmed_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fishing_confirms` (
	`spot_id` integer NOT NULL,
	`player_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`spot_id`, `player_id`)
);
--> statement-breakpoint
CREATE TABLE `black_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`kind` text NOT NULL,
	`reporter_id` text NOT NULL,
	`target_id` text NOT NULL,
	`target_name` text NOT NULL,
	`body` text NOT NULL,
	`evidence` text,
	`status` text DEFAULT 'open' NOT NULL,
	`verdict_note` text,
	`due_at` integer NOT NULL,
	`reporter_claimed` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `black_report_votes` (
	`report_id` integer NOT NULL,
	`voter_id` text NOT NULL,
	`side` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`report_id`, `voter_id`)
);
--> statement-breakpoint
CREATE TABLE `black_reputations` (
	`target_id` text NOT NULL,
	`kind` text NOT NULL,
	`city` text DEFAULT 'sz' NOT NULL,
	`target_name` text NOT NULL,
	`score` integer DEFAULT 80 NOT NULL,
	`upheld_count` integer DEFAULT 0 NOT NULL,
	`rejected_count` integer DEFAULT 0 NOT NULL,
	`flagged_until` integer,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`target_id`, `kind`)
);
--> statement-breakpoint
CREATE TABLE `reporter_standing` (
	`player_id` text PRIMARY KEY NOT NULL,
	`credibility` integer DEFAULT 100 NOT NULL,
	`filed_count` integer DEFAULT 0 NOT NULL,
	`upheld_count` integer DEFAULT 0 NOT NULL,
	`rejected_count` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `black_rent_rollbacks` (
	`player_id` text PRIMARY KEY NOT NULL,
	`rent` integer NOT NULL,
	`base_rent` integer NOT NULL,
	`report_id` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trade_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`poster_id` text NOT NULL,
	`poster_name` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`price` integer,
	`negotiable` integer DEFAULT 0 NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`accepter_id` text,
	`accepter_name` text,
	`escrow_held` integer DEFAULT 0 NOT NULL,
	`escrow_from_id` text,
	`escrow_from_name` text,
	`created_day` integer NOT NULL,
	`expires_day` integer DEFAULT 0 NOT NULL,
	`completion_note` text,
	`dispute_reason` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trade_escrow` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`kind` text DEFAULT 'trade' NOT NULL,
	`payer_id` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'held' NOT NULL,
	`created_at` integer NOT NULL,
	`released_at` integer
);
--> statement-breakpoint
CREATE TABLE `sublet_listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`owner_id` text NOT NULL,
	`owner_name` text NOT NULL,
	`home_loc_id` text DEFAULT 'home' NOT NULL,
	`space` text NOT NULL,
	`monthly_price` integer NOT NULL,
	`deposit` integer DEFAULT 0 NOT NULL,
	`terms` text DEFAULT '' NOT NULL,
	`min_days` integer DEFAULT 0 NOT NULL,
	`max_days` integer DEFAULT 0 NOT NULL,
	`available_from_day` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`tenant_id` text,
	`tenant_name` text,
	`tenancy_start_day` integer DEFAULT 0 NOT NULL,
	`rent_collected` integer DEFAULT 0 NOT NULL,
	`last_rent_day` integer DEFAULT 0 NOT NULL,
	`rent_late` integer DEFAULT 0 NOT NULL,
	`suspicion` integer DEFAULT 0 NOT NULL,
	`own_monthly_rent` integer,
	`created_day` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `overseas_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`buyer_id` text NOT NULL,
	`item_id` text NOT NULL,
	`item_json` text NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`paid_total` integer NOT NULL,
	`duty_due` integer DEFAULT 0 NOT NULL,
	`duty_paid` integer DEFAULT 0 NOT NULL,
	`ship_days` integer NOT NULL,
	`ordered_day` integer NOT NULL,
	`eta_day` integer NOT NULL,
	`status` text DEFAULT 'ordered' NOT NULL,
	`held_once` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `used_furniture_owned` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` text NOT NULL,
	`piece_id` text NOT NULL,
	`base_id` text,
	`name` text NOT NULL,
	`emoji` text DEFAULT '🪑' NOT NULL,
	`room` text DEFAULT 'living' NOT NULL,
	`condition` integer NOT NULL,
	`paid_price` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cheap_goods_owned` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` text NOT NULL,
	`good_id` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text DEFAULT '📦' NOT NULL,
	`kind` text DEFAULT 'other' NOT NULL,
	`state` text DEFAULT 'plain' NOT NULL,
	`condition` integer NOT NULL,
	`buy_price` integer NOT NULL,
	`bought_day` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `used_furniture_listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`seller_id` text NOT NULL,
	`seller_name` text NOT NULL,
	`base_id` text,
	`name` text NOT NULL,
	`emoji` text DEFAULT '🪑' NOT NULL,
	`room` text DEFAULT 'living' NOT NULL,
	`condition` integer NOT NULL,
	`price` integer NOT NULL,
	`new_price` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`listed_day` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lifestyle_states` (
	`player_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`day` integer NOT NULL,
	`status` text DEFAULT 'applied' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `course_enrollments` (
	`player_id` text NOT NULL,
	`course_id` text NOT NULL,
	`start_day` integer NOT NULL,
	`days` integer NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`allowance_paid` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`player_id`, `course_id`)
);
--> statement-breakpoint
CREATE TABLE `course_allowance_days` (
	`player_id` text NOT NULL,
	`course_id` text NOT NULL,
	`day` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`player_id`, `course_id`, `day`)
);
--> statement-breakpoint
CREATE TABLE `guidance_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` text NOT NULL,
	`route_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`start_day` integer NOT NULL,
	`days_worked` integer DEFAULT 0 NOT NULL,
	`total_score` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trial_days` (
	`trial_id` integer NOT NULL,
	`day` integer NOT NULL,
	`score` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`trial_id`, `day`)
);
--> statement-breakpoint
CREATE TABLE `flat_gigs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`poster_id` text NOT NULL,
	`poster_name` text NOT NULL,
	`title` text NOT NULL,
	`desc` text DEFAULT '' NOT NULL,
	`pay` integer DEFAULT 0 NOT NULL,
	`kind` text DEFAULT 'help' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`taker_id` text,
	`taker_name` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stalls` (
	`player_id` text PRIMARY KEY NOT NULL,
	`city` text NOT NULL,
	`kind` text NOT NULL,
	`day` integer NOT NULL,
	`lvl` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sanhe_shift_logs` (
	`player_id` text NOT NULL,
	`day` integer NOT NULL,
	`shift_id` text NOT NULL,
	`pay` integer NOT NULL,
	`city` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`player_id`, `day`)
);
--> statement-breakpoint
CREATE TABLE `delivery_pool_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`customer_id` text NOT NULL,
	`customer_name` text NOT NULL,
	`platform_id` text DEFAULT '' NOT NULL,
	`restaurant_id` text NOT NULL,
	`restaurant_name` text NOT NULL,
	`items_json` text DEFAULT '[]' NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`rider_fee` integer NOT NULL,
	`dest_id` text,
	`dest_name` text NOT NULL,
	`distance` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`rider_id` text,
	`rider_name` text,
	`created_at` integer NOT NULL,
	`deadline_at` integer NOT NULL,
	`taken_at` integer,
	`delivered_at` integer,
	`tip` integer DEFAULT 0 NOT NULL,
	`stars` integer
);
--> statement-breakpoint
CREATE TABLE `delivery_riders` (
	`player_id` text PRIMARY KEY NOT NULL,
	`rating` integer DEFAULT 500 NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`on_time` integer DEFAULT 0 NOT NULL,
	`late` integer DEFAULT 0 NOT NULL,
	`cancelled` integer DEFAULT 0 NOT NULL,
	`total_earned` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `delivery_sponsors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city` text NOT NULL,
	`name` text NOT NULL,
	`cuisine` text DEFAULT '' NOT NULL,
	`emoji` text DEFAULT '🍜' NOT NULL,
	`tier` text DEFAULT '' NOT NULL,
	`dishes_json` text DEFAULT '[]' NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`ends_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `strays_city_idx` ON `strays` (`city`, `adopted`);
--> statement-breakpoint
CREATE INDEX `notices_city_idx` ON `notices` (`city`, `status`);
--> statement-breakpoint
CREATE INDEX `snake_city_idx` ON `snake_reports` (`city`, `confirmations`);
--> statement-breakpoint
CREATE INDEX `fishing_city_idx` ON `fishing_spots` (`city`, `confirmations`);
--> statement-breakpoint
CREATE INDEX `black_reports_city_idx` ON `black_reports` (`city`, `status`);
--> statement-breakpoint
CREATE INDEX `trade_tasks_city_idx` ON `trade_tasks` (`city`, `status`);
--> statement-breakpoint
CREATE INDEX `sublet_city_idx` ON `sublet_listings` (`city`, `status`);
--> statement-breakpoint
CREATE INDEX `overseas_buyer_idx` ON `overseas_orders` (`buyer_id`);
--> statement-breakpoint
CREATE INDEX `flat_gigs_city_idx` ON `flat_gigs` (`city`, `status`);
--> statement-breakpoint
CREATE INDEX `pool_city_idx` ON `delivery_pool_orders` (`city`, `status`);
