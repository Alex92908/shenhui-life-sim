CREATE TABLE `weather_snapshots` (
	`city_key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`fetched_at` integer NOT NULL
);
