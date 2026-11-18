import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';

const serverRoot = path.resolve(__dirname, '../..');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy server/.env.example to server/.env, or add DATABASE_URL in your Render service.',
  );
}

const poolConfig: PoolConfig = {
  connectionString,
  max: Number(process.env.PG_POOL_MAX ?? 5),
  idleTimeoutMillis: 30_000,
};

if (/neon\.tech/i.test(connectionString) && !/sslmode=/i.test(connectionString)) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

export const pool = new Pool(poolConfig);
export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(serverRoot, 'drizzle');
  if (!fs.existsSync(migrationsFolder)) {
    throw new Error(
      `Migrations folder not found at ${migrationsFolder}. Run "npm run db:generate" first.`,
    );
  }
  await migrate(db, { migrationsFolder });
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
