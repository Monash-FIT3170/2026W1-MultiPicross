import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { openAPISpecs } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { runMigrations } from "./db/migrate.js";
import { importPuzzles } from "./db/import-puzzles.js";
import authRoutes from "./auth/routes.js";
import spRoutes from "./singleplayer/routes.js";
import mpRoutes from "./multiplayer/routes.js";

const app = new Hono().basePath("/api");
app.route("/multiplayer", mpRoutes);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/auth", authRoutes);
app.route("/singleplayer", spRoutes);

app.get(
  "/openapi",
  openAPISpecs(app, {
    documentation: {
      info: {
        title: "Multipicross API",
        version: "1.0.0",
        description: "Multipicross game API",
      },
      servers: [
        { url: "https://multipicross.com", description: "Production" },
        {
          url: "http://multipicross.localhost",
          description: "Development (Traefik)",
        },
        { url: "http://localhost:3001", description: "Development (direct)" },
      ],
    },
  }),
);

app.get("/docs", Scalar({ spec: { url: "/api/openapi" } }));

await runMigrations();
await importPuzzles();

serve({ fetch: app.fetch, port: 3000 }, (info) =>
  console.log(`Server is running on http://localhost:${info.port}`),
);
