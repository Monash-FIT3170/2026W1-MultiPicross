import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
const pool = new pg.Pool({
    host: process.env.DB_HOST ?? "localhost",
    user: process.env.DB_USER ?? "postgres",
    password: process.env.DB_PASSWORD ?? "postgres",
    database: process.env.DB_NAME ?? "todochat",
});
export const db = drizzle(pool, { schema });
