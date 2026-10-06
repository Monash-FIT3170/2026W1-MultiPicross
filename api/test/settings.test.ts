process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { checkTestDb } from "./support/db.js";

const { ready, reason } = await checkTestDb();

if (!ready) {
  test("settings integration", { skip: reason }, () => {});
} else {
  const { db, pgClient } = await import("../src/db/client.js");
  const { accounts } = await import("../src/db/schema.js");
  const { inArray, eq } = await import("drizzle-orm");
  const { Hono } = await import("hono");
  const { default: settingsRoutes, sanitizeStoredSettings } =
    await import("../src/settings/routes.js");
  const { signAccessToken } = await import("../src/auth/helpers.js");
  const { ACCESS_COOKIE, CSRF_COOKIE } = await import("../src/auth/cookies.js");

  const app = new Hono().route("/settings", settingsRoutes);
  const createdAccountIds: string[] = [];

  async function cleanup(): Promise<void> {
    if (createdAccountIds.length > 0) {
      await db.delete(accounts).where(inArray(accounts.id, createdAccountIds));
      createdAccountIds.length = 0;
    }
  }

  before(cleanup);
  after(cleanup);
  after(() => pgClient.end({ timeout: 1 }));

  async function newAccount(): Promise<{ id: string; cookie: string }> {
    const [account] = await db
      .insert(accounts)
      .values({ kind: "sso" })
      .returning({ id: accounts.id });
    createdAccountIds.push(account.id);
    const token = await signAccessToken({ sub: account.id });
    return {
      id: account.id,
      cookie: `${ACCESS_COOKIE}=${token}; ${CSRF_COOKIE}=csrf`,
    };
  }

  function patch(cookie: string, body: unknown) {
    return app.request("/settings", {
      method: "PATCH",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": "csrf",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  test("a new account has no saved settings", async () => {
    const { cookie } = await newAccount();
    const res = await app.request("/settings", { headers: { Cookie: cookie } });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {});
  });

  test("PATCH merges into what was saved before", async () => {
    const { cookie } = await newAccount();
    assert.equal((await patch(cookie, { theme: "dark" })).status, 200);
    const res = await patch(cookie, { cellFillPop: false });
    assert.deepEqual(await res.json(), { theme: "dark", cellFillPop: false });

    const got = await app.request("/settings", { headers: { Cookie: cookie } });
    assert.deepEqual(await got.json(), { theme: "dark", cellFillPop: false });
  });

  test("PATCH rejects unknown keys and bad values", async () => {
    const { id, cookie } = await newAccount();
    assert.equal((await patch(cookie, { theme: "neon" })).status, 400);
    assert.equal((await patch(cookie, { isAdmin: true })).status, 400);
    const [row] = await db
      .select({ settings: accounts.settings })
      .from(accounts)
      .where(eq(accounts.id, id));
    assert.deepEqual(row.settings, {});
  });

  test("PATCH without the CSRF header is rejected", async () => {
    const { cookie } = await newAccount();
    const res = await app.request("/settings", {
      method: "PATCH",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "dark" }),
    });
    assert.equal(res.status, 403);
  });

  test("requests without a session are rejected", async () => {
    const res = await app.request("/settings");
    assert.equal(res.status, 401);
  });

  test("stored keys the schema no longer accepts are dropped on read", () => {
    assert.deepEqual(
      sanitizeStoredSettings({ theme: "dark", oldKey: 1, cellFillPop: "yes" }),
      { theme: "dark" },
    );
    assert.deepEqual(sanitizeStoredSettings(null), {});
  });
}
