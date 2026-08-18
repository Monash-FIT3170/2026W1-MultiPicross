import postgres from "postgres";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} must be set`);
  return val;
}

const connectionString = `postgres://${requireEnv("DB_USER")}:${encodeURIComponent(process.env.DB_PASSWORD ?? "")}@${requireEnv("DB_HOST")}:5432/${requireEnv("DB_NAME")}`;

export const sql = postgres(connectionString);
