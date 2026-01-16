import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { config } from '@/config';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

const dbPath = config.database.path;

if (dbPath !== ':memory:') {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

const sqlite = new Database(dbPath);
sqlite.exec('PRAGMA journal_mode = WAL');
sqlite.exec('PRAGMA foreign_keys = ON');

const db = drizzle(sqlite);

console.log('Running migrations...');
migrate(db, { migrationsFolder: './src/db/migrations' });
console.log('Migrations complete');

sqlite.close();
