PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_elo_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`server_id` integer NOT NULL,
	`wordle_number` integer NOT NULL,
	`old_elo` integer NOT NULL,
	`new_elo` integer NOT NULL,
	`change` integer NOT NULL,
	`player_score` integer,
	`avg_score` integer NOT NULL,
	`participants` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_elo_history`("id", "user_id", "server_id", "wordle_number", "old_elo", "new_elo", "change", "player_score", "avg_score", "participants", "created_at") SELECT "id", "user_id", "server_id", "wordle_number", "old_elo", "new_elo", "change", "player_score", "avg_score", "participants", "created_at" FROM `elo_history`;--> statement-breakpoint
DROP TABLE `elo_history`;--> statement-breakpoint
ALTER TABLE `__new_elo_history` RENAME TO `elo_history`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `elo_history_user_id_wordle_number_unique` ON `elo_history` (`user_id`,`wordle_number`);