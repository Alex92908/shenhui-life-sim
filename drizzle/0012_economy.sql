ALTER TABLE `players` ADD `reported_money` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `players` ADD `earn_budget` integer DEFAULT 60000 NOT NULL;
--> statement-breakpoint
ALTER TABLE `players` ADD `budget_at` integer;
--> statement-breakpoint
ALTER TABLE `players` ADD `cosmetic` text;
--> statement-breakpoint
CREATE TABLE `ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` text NOT NULL,
	`season` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`balance` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ledger_player_idx` ON `ledger` (`player_id`, `id`);
--> statement-breakpoint
CREATE INDEX `ledger_kind_idx` ON `ledger` (`kind`, `created_at`);
--> statement-breakpoint
CREATE TABLE `star_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`amount` integer NOT NULL,
	`balance` integer NOT NULL,
	`reason` text NOT NULL,
	`ref` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `star_ledger_account_idx` ON `star_ledger` (`account_id`, `id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `star_ledger_ref_idx` ON `star_ledger` (`reason`, `ref`);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`product` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider` text NOT NULL,
	`provider_ref` text,
	`created_at` integer NOT NULL,
	`paid_at` integer,
	`refunded_at` integer
);
--> statement-breakpoint
CREATE INDEX `orders_account_idx` ON `orders` (`account_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE `entitlements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` text NOT NULL,
	`kind` text NOT NULL,
	`item` text NOT NULL,
	`season` text,
	`expires_at` integer,
	`order_id` text,
	`created_at` integer NOT NULL,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE INDEX `entitlements_account_idx` ON `entitlements` (`account_id`, `kind`);
