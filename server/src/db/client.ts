import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

const serverRoot = path.resolve(__dirname, '../..');
const dataDir = path.join(serverRoot, 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const dbPath = process.env.DATABASE_URL ?? path.join(dataDir, 'rove.db');

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db: BetterSQLite3Database<typeof schema> = drizzle(sqlite, { schema });
export const sqliteClient = sqlite;

export function runMigrations(): void {
  const migrationsFolder = path.join(serverRoot, 'drizzle');
  if (!fs.existsSync(migrationsFolder)) {
    throw new Error(
      `Migrations folder not found at ${migrationsFolder}. Run "npm run db:generate" first.`,
    );
  }
  migrate(db, { migrationsFolder });
}
