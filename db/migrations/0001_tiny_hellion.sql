CREATE TABLE `collection_items` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`tmdb_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_items_unique` ON `collection_items` (`collection_id`,`tmdb_id`,`media_type`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`autoplay_next` integer DEFAULT true NOT NULL,
	`subtitles_enabled` integer DEFAULT true NOT NULL,
	`subtitles_language` text DEFAULT 'en' NOT NULL,
	`content_maturity` text DEFAULT 'all' NOT NULL,
	`preferred_language` text DEFAULT 'en' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_preferences`("id", "profile_id", "autoplay_next", "subtitles_enabled", "subtitles_language", "content_maturity", "preferred_language", "updated_at") SELECT "id", "profile_id", "autoplay_next", "subtitles_enabled", "subtitles_language", "content_maturity", "preferred_language", "updated_at" FROM `preferences`;--> statement-breakpoint
DROP TABLE `preferences`;--> statement-breakpoint
ALTER TABLE `__new_preferences` RENAME TO `preferences`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `preferences_profile_id_unique` ON `preferences` (`profile_id`);