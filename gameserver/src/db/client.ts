import postgres from "postgres";
import { requireEnv } from "../env.js";

// DB_PASSWORD is read directly rather than via requireEnv(): an empty password
// is a legitimate configuration (e.g. trust auth), so it must not throw.
const connectionString = `postgres://${requireEnv("DB_USER")}:${encodeURIComponent(process.env.DB_PASSWORD ?? "")}@${requireEnv("DB_HOST")}:5432/${requireEnv("DB_NAME")}`;

export const sql = postgres(connectionString);
