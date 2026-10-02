import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./client.js";
export async function runMigrations() {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied");
}
