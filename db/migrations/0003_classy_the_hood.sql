PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_watch_history` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`title` text NOT NULL,
	`poster_path` text,
	`backdrop_path` text,
	`year` text DEFAULT '' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`position_seconds` integer DEFAULT 0 NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`season` integer DEFAULT 0 NOT NULL,
	`episode` integer DEFAULT 0 NOT NULL,
	`watched_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_watch_history`("id", "profile_id", "tmdb_id", "media_type", "title", "poster_path", "backdrop_path", "year", "progress", "position_seconds", "duration_seconds", "season", "episode", "watched_at") SELECT "id", "profile_id", "tmdb_id", "media_type", "title", "poster_path", "backdrop_path", "year", "progress", "position_seconds", "duration_seconds", coalesce("season", 0), coalesce("episode", 0), "watched_at" FROM `watch_history`;--> statement-breakpoint
DROP TABLE `watch_history`;--> statement-breakpoint
ALTER TABLE `__new_watch_history` RENAME TO `watch_history`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `watch_history_unique` ON `watch_history` (`profile_id`,`tmdb_id`,`media_type`,`season`,`episode`);