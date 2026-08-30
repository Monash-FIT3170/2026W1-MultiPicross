import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { openAPISpecs } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { env } from "./env.js";
import { runMigrations } from "./db/migrate.js";
import { importPuzzles } from "./db/import-puzzles.js";
import authRoutes from "./auth/routes.js";
import spRoutes from "./singleplayer/routes.js";
import { assertOidcEnv, getOidcConfig } from "./auth/oidc.js";
import { createServiceAccount } from "./auth/service-account.js";

const app = new Hono().basePath("/api");

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

env("JWT_ACCESS_SECRET");
env("JWT_REFRESH_SECRET");
// Separate from JWT_ACCESS_SECRET on purpose, see signRoomToken in auth/helpers.ts.
env("JWT_ROOM_SECRET");
assertOidcEnv();

await runMigrations();
await importPuzzles();

// No-op when unset, so production can seed once and then unset these rather
// than leaving a password in the environment forever. Never resets an existing password.
const adminUsername = env("ADMIN_USERNAME", "");
const adminPassword = env("ADMIN_PASSWORD", "");
if (adminUsername && adminPassword) {
  const result = await createServiceAccount(adminUsername, adminPassword);
  if (result.created) console.log(`Seeded service account "${adminUsername}"`);
}

serve({ fetch: app.fetch, port: 3000 }, (info) =>
  console.log(`Server is running on http://localhost:${info.port}`),
);

// Warm the OIDC discovery cache so the first real login doesn't pay for it; never let a down/unset IdP crash boot.
try {
  getOidcConfig().catch((e: unknown) =>
    console.warn("OIDC discovery warm-up failed:", e),
  );
} catch (e: unknown) {
  console.warn("OIDC discovery warm-up failed:", e);
}
