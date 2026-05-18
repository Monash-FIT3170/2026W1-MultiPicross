import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} must be set`);
  return val;
}

const DB_HOST = requireEnv('DB_HOST');
const DB_USER = requireEnv('DB_USER');
const DB_NAME = requireEnv('DB_NAME');
const DB_PASSWORD = process.env.DB_PASSWORD ?? '';
const connectionString = `postgres://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:5432/${DB_NAME}`;

const sql = postgres(connectionString);
export const db = drizzle(sql, { schema });
