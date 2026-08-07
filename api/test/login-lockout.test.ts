process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { checkTestDb } from "./support/db.js";

const { ready, reason } = await checkTestDb();

if (!ready) {
  test("login lockout integration", { skip: reason }, () => {});
} else {
  const { db, pgClient } = await import("../src/db/client.js");
  const { accounts, loginAttempts } = await import("../src/db/schema.js");
  const { inArray } = await import("drizzle-orm");
  const { hashPassword } = await import("../src/auth/helpers.js");
  const authRoutes = (await import("../src/auth/routes.js")).default;

  const PASSWORD = "correct-horse-battery-staple";
  const createdAccountIds: string[] = [];
  const usedUsernames: string[] = [];

  async function cleanup(): Promise<void> {
    if (createdAccountIds.length > 0) {
      await db.delete(accounts).where(inArray(accounts.id, createdAccountIds));
      createdAccountIds.length = 0;
    }
    if (usedUsernames.length > 0) {
      await db
        .delete(loginAttempts)
        .where(inArray(loginAttempts.username, usedUsernames));
      usedUsernames.length = 0;
    }
  }

  before(cleanup);
  after(cleanup);
  // postgres-js keeps idle connections open, which would otherwise hang the test runner's exit.
  after(() => pgClient.end({ timeout: 1 }));

  function uniqueUsername(label: string): string {
    const username = `test-lockout-${label}-${crypto.randomUUID().slice(0, 8)}`;
    usedUsernames.push(username);
    return username;
  }

  function postLogin(username: string, password: string) {
    return authRoutes.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  }

  test("5 failures in the window lock the username, even against the correct password", async () => {
    const username = uniqueUsername("real");
    const passwordHash = await hashPassword(PASSWORD);
    const [account] = await db
      .insert(accounts)
      .values({ kind: "service", username, passwordHash })
      .returning({ id: accounts.id });
    createdAccountIds.push(account.id);

    for (let i = 0; i < 5; i++) {
      const res = await postLogin(username, "wrong-password");
      assert.equal(res.status, 401);
    }
    const lockedRes = await postLogin(username, PASSWORD);
    assert.equal(lockedRes.status, 429);
  });

  test("a nonexistent username locks identically after 5 attempts (enumeration-oracle guard)", async () => {
    const username = uniqueUsername("ghost");

    for (let i = 0; i < 5; i++) {
      const res = await postLogin(username, "irrelevant");
      assert.equal(res.status, 401);
    }
    const lockedRes = await postLogin(username, "irrelevant");
    assert.equal(lockedRes.status, 429);
  });

  test("a successful login clears the counter", async () => {
    const username = uniqueUsername("clears");
    const passwordHash = await hashPassword(PASSWORD);
    const [account] = await db
      .insert(accounts)
      .values({ kind: "service", username, passwordHash })
      .returning({ id: accounts.id });
    createdAccountIds.push(account.id);

    for (let i = 0; i < 3; i++) {
      const res = await postLogin(username, "wrong-password");
      assert.equal(res.status, 401);
    }
    const successRes = await postLogin(username, PASSWORD);
    assert.equal(successRes.status, 200);

    const afterSuccess = await postLogin(username, "wrong-password");
    assert.equal(
      afterSuccess.status,
      401,
      "counter must have reset, not still be locked",
    );
  });

  test("the window expiring releases the lock", async () => {
    const username = uniqueUsername("expired");
    const passwordHash = await hashPassword(PASSWORD);
    const [account] = await db
      .insert(accounts)
      .values({ kind: "service", username, passwordHash })
      .returning({ id: accounts.id });
    createdAccountIds.push(account.id);

    const staleTime = new Date(Date.now() - 16 * 60 * 1000);
    await db
      .insert(loginAttempts)
      .values(
        Array.from({ length: 5 }, () => ({ username, attemptedAt: staleTime })),
      );

    const res = await postLogin(username, PASSWORD);
    assert.equal(
      res.status,
      200,
      "attempts outside the 15 minute window must not count",
    );
  });
}
