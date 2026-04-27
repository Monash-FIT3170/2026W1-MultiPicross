import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db/index.js";
import todos from "./routes/todos.js";
import { cors } from "hono/cors";
const app = new Hono();
app.use("*", cors({ origin: "http://localhost:5173" }));
app.route("/todos", todos);
await migrate(db, { migrationsFolder: "./drizzle" });
serve({
    fetch: app.fetch,
    port: 3000,
}, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});
