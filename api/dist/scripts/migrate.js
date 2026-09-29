import { runMigrations } from "../db/migrate.js";
await runMigrations();
process.exit(0);
