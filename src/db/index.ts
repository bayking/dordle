import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '@/db/schema';
import { config } from '@/config';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlite: Database | null = null;

export function getDb() {
  if (!db) {
    const dbPath = config.database.path;

    if (dbPath !== ':memory:') {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    sqlite = new Database(dbPath);
    sqlite.exec('PRAGMA journal_mode = WAL');
    sqlite.exec('PRAGMA foreign_keys = ON');

    db = drizzle(sqlite, { schema });
  }
  return db;
}

export function closeDb() {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}

export function initializeDb() {
  const database = getDb();

  sqlite!.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL UNIQUE,
      wordle_channel_id TEXT,
      summary_channel_id TEXT,
      timezone TEXT DEFAULT 'UTC',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL,
      wordle_username TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(server_id, discord_id)
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      wordle_number INTEGER NOT NULL,
      score INTEGER NOT NULL,
      played_at INTEGER NOT NULL DEFAULT (unixepoch()),
      message_id TEXT,
      UNIQUE(server_id, user_id, wordle_number)
    );

    CREATE TABLE IF NOT EXISTS scheduled_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('daily', 'weekly', 'monthly')),
      last_posted_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_games_server_user ON games(server_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_games_played_at ON games(played_at);
    CREATE INDEX IF NOT EXISTS idx_users_server ON users(server_id);
  `);

  return database;
}

export { schema };
