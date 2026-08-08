process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { checkTestDb } from "./support/db.js";

const { ready, reason } = await checkTestDb();

if (!ready) {
  test("service login integration", { skip: reason }, () => {});
} else {
  const { db, pgClient } = await import("../src/db/client.js");
  const { accounts, loginAttempts } = await import("../src/db/schema.js");
  const { inArray } = await import("drizzle-orm");
  const { hashPassword } = await import("../src/auth/helpers.js");
  const authRoutes = (await import("../src/auth/routes.js")).default;

  const PASSWORD = "correct-horse-battery-staple";
  const createdAccountIds: string[] = [];
  const createdUsernames: string[] = [];

  async function cleanup(): Promise<void> {
    if (createdAccountIds.length > 0) {
      await db.delete(accounts).where(inArray(accounts.id, createdAccountIds));
      createdAccountIds.length = 0;
    }
    if (createdUsernames.length > 0) {
      await db
        .delete(loginAttempts)
        .where(inArray(loginAttempts.username, createdUsernames));
      createdUsernames.length = 0;
    }
  }

  before(cleanup);
  after(cleanup);
  // postgres-js keeps idle connections open, which would otherwise hang the test runner's exit.
  after(() => pgClient.end({ timeout: 1 }));

  function uniqueUsername(label: string): string {
    const username = `test-service-login-${label}-${crypto.randomUUID().slice(0, 8)}`;
    createdUsernames.push(username);
    return username;
  }

  function postLogin(username: string, password: string) {
    return authRoutes.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  }

  test("a service account with the correct password logs in", async () => {
    const username = uniqueUsername("ok");
    const passwordHash = await hashPassword(PASSWORD);
    const [account] = await db
      .insert(accounts)
      .values({ kind: "service", username, passwordHash })
      .returning({ id: accounts.id });
    createdAccountIds.push(account.id);

    const res = await postLogin(username, PASSWORD);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      id: string;
      handle: string | null;
      kind: string;
    };
    assert.equal(body.id, account.id);
    assert.equal(body.handle, null);
    assert.equal(body.kind, "service");
  });

  test("an sso account is rejected with the generic 401 even if a password hash is present", async () => {
    const username = uniqueUsername("sso");
    const passwordHash = await hashPassword(PASSWORD);
    const [account] = await db
      .insert(accounts)
      .values({ kind: "sso", username, passwordHash })
      .returning({ id: accounts.id });
    createdAccountIds.push(account.id);

    const res = await postLogin(username, PASSWORD);
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Invalid credentials");
  });

  test("an account with a null password hash is rejected rather than throwing", async () => {
    const username = uniqueUsername("nullhash");
    const [account] = await db
      .insert(accounts)
      .values({ kind: "service", username, passwordHash: null })
      .returning({ id: accounts.id });
    createdAccountIds.push(account.id);

    const res = await postLogin(username, PASSWORD);
    assert.equal(res.status, 401);
  });

  test("POST /register returns 404 because the route no longer exists", async () => {
    const res = await authRoutes.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "whoever", password: "whatever123" }),
    });
    assert.equal(res.status, 404);
  });
}
