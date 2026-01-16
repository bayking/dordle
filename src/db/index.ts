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

export function setDb(testDb: ReturnType<typeof drizzle<typeof schema>>) {
  db = testDb;
}

export function resetDb() {
  db = null;
  sqlite = null;
}

export { schema };
