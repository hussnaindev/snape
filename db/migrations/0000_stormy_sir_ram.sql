CREATE TABLE `passwords` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`hash` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`autoplay_next` integer DEFAULT true NOT NULL,
	`subtitles_enabled` integer DEFAULT false NOT NULL,
	`subtitles_language` text DEFAULT 'en' NOT NULL,
	`content_maturity` text DEFAULT 'all' NOT NULL,
	`preferred_language` text DEFAULT 'en' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `preferences_profile_id_unique` ON `preferences` (`profile_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`is_default` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `watch_history` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`title` text NOT NULL,
	`poster_path` text,
	`backdrop_path` text,
	`year` text DEFAULT '' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`season` integer,
	`episode` integer,
	`watched_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watch_history_unique` ON `watch_history` (`profile_id`,`tmdb_id`,`media_type`);--> statement-breakpoint
CREATE TABLE `watchlist` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watchlist_unique` ON `watchlist` (`profile_id`,`tmdb_id`,`media_type`);