import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { sValidator } from "@hono/standard-validator";
import * as v from "valibot";
import { toJsonSchema } from "@valibot/to-json-schema";
import { eq, sql } from "drizzle-orm";
import type { OpenAPIV3 } from "openapi-types";
import { db } from "../db/client.js";
import { accounts } from "../db/schema.js";
import { requireAuth } from "../auth/middleware.js";
import { csrf } from "../auth/csrf.js";

// Every field optional so PATCH can send just the one that changed. Strict so
// a typo or a stale client can't park junk keys in the column forever.
export const SettingsPatch = v.strictObject({
  theme: v.optional(v.picklist(["light", "dark", "high-contrast"])),
  animationLevel: v.optional(v.picklist(["full", "subtle", "off"])),
  cellFillPop: v.optional(v.boolean()),
  showOpponentProgress: v.optional(v.boolean()),
});

export type Settings = v.InferOutput<typeof SettingsPatch>;

// Drops keys a later version stopped accepting, so old rows can't send
// the client values it no longer understands.
export function sanitizeStoredSettings(stored: unknown): Settings {
  if (typeof stored !== "object" || stored === null) return {};
  const out: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(SettingsPatch.entries)) {
    const value = (stored as Record<string, unknown>)[key];
    if (value !== undefined && v.is(schema, value)) out[key] = value;
  }
  return out as Settings;
}

const errorSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: { error: { type: "string" } },
};
const errorContent = { "application/json": { schema: errorSchema } };
const settingsContent = {
  "application/json": {
    schema: toJsonSchema(SettingsPatch) as unknown as OpenAPIV3.SchemaObject,
  },
};

const settings = new Hono();

settings.get(
  "/",
  requireAuth,
  describeRoute({
    tags: ["Settings"],
    summary: "Get the current user's saved settings",
    description: "Only settings the user has changed are present.",
    responses: {
      200: { description: "Saved settings", content: settingsContent },
      401: { description: "Not authenticated", content: errorContent },
      404: { description: "Account not found", content: errorContent },
    },
  }),
  async (c) => {
    const { sub: accountId } = c.get("jwtPayload") as { sub: string };
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      columns: { settings: true },
    });
    if (!account) return c.json({ error: "Account not found" }, 404);
    return c.json(sanitizeStoredSettings(account.settings));
  },
);

settings.patch(
  "/",
  requireAuth,
  csrf,
  describeRoute({
    tags: ["Settings"],
    summary: "Update some of the current user's settings",
    description: "Merges the given fields into the saved settings.",
    requestBody: { required: true, content: settingsContent },
    responses: {
      200: {
        description: "Settings after the update",
        content: settingsContent,
      },
      400: { description: "Invalid settings", content: errorContent },
      401: { description: "Not authenticated", content: errorContent },
      403: { description: "Invalid CSRF token", content: errorContent },
      404: { description: "Account not found", content: errorContent },
    },
  }),
  sValidator("json", SettingsPatch, (result, c) => {
    if (!result.success)
      return c.json(
        { error: result.error.map((i) => i.message).join(", ") },
        400,
      );
  }),
  async (c) => {
    const { sub: accountId } = c.get("jwtPayload") as { sub: string };
    const patch = c.req.valid("json" as never) as Settings;

    // Merge in SQL so two quick changes from different tabs can't overwrite
    // each other with a stale read.
    const [updated] = await db
      .update(accounts)
      .set({
        settings: sql`${accounts.settings} || ${JSON.stringify(patch)}::jsonb`,
      })
      .where(eq(accounts.id, accountId))
      .returning({ settings: accounts.settings });
    if (!updated) return c.json({ error: "Account not found" }, 404);
    return c.json(sanitizeStoredSettings(updated.settings));
  },
);

export default settings;
