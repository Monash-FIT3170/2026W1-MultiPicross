import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { env } from "../env.js";
const DB_HOST = env("DB_HOST");
const DB_USER = env("DB_USER");
const DB_NAME = env("DB_NAME");
const DB_PASSWORD = env("DB_PASSWORD", "");
const connectionString = `postgres://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:5432/${DB_NAME}`;
const sql = postgres(connectionString);
export const db = drizzle(sql, { schema });
// Exported so tests can close the pool in an `after` hook; postgres-js keeps
// idle connections open, which would otherwise hang the test runner's exit.
export const pgClient = sql;
