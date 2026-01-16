import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '@/db/schema';
import { setDb, resetDb } from '@/db';

let testDb: BunSQLiteDatabase<typeof schema> | null = null;
let testSqlite: Database | null = null;

export function setupTestDb(): BunSQLiteDatabase<typeof schema> {
  testSqlite = new Database(':memory:');

  testSqlite.exec(`
    CREATE TABLE servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL UNIQUE,
      wordle_channel_id TEXT,
      summary_channel_id TEXT,
      timezone TEXT DEFAULT 'UTC',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL,
      wordle_username TEXT,
      created_at INTEGER NOT NULL,
      elo INTEGER NOT NULL DEFAULT 1500,
      elo_games_played INTEGER NOT NULL DEFAULT 0,
      last_played_at INTEGER,
      UNIQUE(server_id, discord_id)
    );

    CREATE TABLE games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      wordle_number INTEGER NOT NULL,
      score INTEGER NOT NULL,
      played_at INTEGER NOT NULL,
      message_id TEXT,
      UNIQUE(server_id, user_id, wordle_number)
    );

    CREATE TABLE scheduled_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      last_posted_at INTEGER,
      UNIQUE(server_id, type)
    );

    CREATE TABLE elo_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      wordle_number INTEGER NOT NULL,
      old_elo INTEGER NOT NULL,
      new_elo INTEGER NOT NULL,
      change INTEGER NOT NULL,
      player_score INTEGER NOT NULL,
      avg_score INTEGER NOT NULL,
      participants INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, wordle_number)
    );
  `);

  testDb = drizzle(testSqlite, { schema });
  setDb(testDb);

  return testDb;
}

export function teardownTestDb(): void {
  if (testSqlite) {
    testSqlite.close();
    testSqlite = null;
  }
  testDb = null;
  resetDb();
}
