CREATE TABLE `elo_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`server_id` integer NOT NULL,
	`wordle_number` integer NOT NULL,
	`old_elo` integer NOT NULL,
	`new_elo` integer NOT NULL,
	`change` integer NOT NULL,
	`player_score` integer NOT NULL,
	`avg_score` integer NOT NULL,
	`participants` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `elo_history_user_id_wordle_number_unique` ON `elo_history` (`user_id`,`wordle_number`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`server_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`wordle_number` integer NOT NULL,
	`score` integer NOT NULL,
	`played_at` integer NOT NULL,
	`message_id` text,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_server_id_user_id_wordle_number_unique` ON `games` (`server_id`,`user_id`,`wordle_number`);--> statement-breakpoint
CREATE TABLE `scheduled_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`server_id` integer NOT NULL,
	`type` text NOT NULL,
	`last_posted_at` integer,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scheduled_posts_server_id_type_unique` ON `scheduled_posts` (`server_id`,`type`);--> statement-breakpoint
CREATE TABLE `servers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_id` text NOT NULL,
	`wordle_channel_id` text,
	`summary_channel_id` text,
	`timezone` text DEFAULT 'UTC',
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `servers_discord_id_unique` ON `servers` (`discord_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`server_id` integer NOT NULL,
	`discord_id` text NOT NULL,
	`wordle_username` text,
	`elo` integer DEFAULT 1500 NOT NULL,
	`elo_games_played` integer DEFAULT 0 NOT NULL,
	`last_played_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_server_id_discord_id_unique` ON `users` (`server_id`,`discord_id`);