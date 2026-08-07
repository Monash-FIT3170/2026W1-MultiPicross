process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { checkTestDb } from "./support/db.js";

const { ready, reason } = await checkTestDb();

if (!ready) {
  test("handle integration", { skip: reason }, () => {});
} else {
  const { db, pgClient } = await import("../src/db/client.js");
  const { accounts } = await import("../src/db/schema.js");
  const { inArray } = await import("drizzle-orm");
  const { signAccessToken } = await import("../src/auth/helpers.js");
  const authRoutes = (await import("../src/auth/routes.js")).default;

  const createdAccountIds: string[] = [];

  async function cleanup(): Promise<void> {
    if (createdAccountIds.length === 0) return;
    await db.delete(accounts).where(inArray(accounts.id, createdAccountIds));
    createdAccountIds.length = 0;
  }

  before(cleanup);
  after(cleanup);
  // postgres-js keeps idle connections open, which would otherwise hang the test runner's exit.
  after(() => pgClient.end({ timeout: 1 }));

  async function createSsoAccount(): Promise<string> {
    const [account] = await db
      .insert(accounts)
      .values({ kind: "sso" })
      .returning({ id: accounts.id });
    createdAccountIds.push(account.id);
    return account.id;
  }

  async function postHandle(accountId: string, handle: string) {
    const accessToken = await signAccessToken({ sub: accountId });
    return authRoutes.request("/handle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `access_token=${accessToken}; csrf_token=test-csrf`,
        "X-CSRF-Token": "test-csrf",
      },
      body: JSON.stringify({ handle }),
    });
  }

  test("a valid handle is accepted", async () => {
    const accountId = await createSsoAccount();
    const res = await postHandle(
      accountId,
      `handle-${crypto.randomUUID().slice(0, 8)}`,
    );
    assert.equal(res.status, 200);
  });

  test("a duplicate handle returns 409", async () => {
    const handle = `handle-${crypto.randomUUID().slice(0, 8)}`;
    const first = await createSsoAccount();
    const firstRes = await postHandle(first, handle);
    assert.equal(firstRes.status, 200);

    const second = await createSsoAccount();
    const secondRes = await postHandle(second, handle);
    assert.equal(secondRes.status, 409);
  });

  test("a second write against an account that already has a handle is rejected", async () => {
    const accountId = await createSsoAccount();
    const setRes = await postHandle(
      accountId,
      `handle-${crypto.randomUUID().slice(0, 8)}`,
    );
    assert.equal(setRes.status, 200);

    const renameRes = await postHandle(
      accountId,
      `handle-${crypto.randomUUID().slice(0, 8)}`,
    );
    assert.equal(renameRes.status, 409);
  });

  test("invalid characters are rejected", async () => {
    const accountId = await createSsoAccount();
    const res = await postHandle(accountId, "bad!name");
    assert.equal(res.status, 400);
  });

  test("out-of-range lengths are rejected", async () => {
    const shortId = await createSsoAccount();
    const shortRes = await postHandle(shortId, "ab");
    assert.equal(shortRes.status, 400);

    const longId = await createSsoAccount();
    const longRes = await postHandle(longId, "a".repeat(21));
    assert.equal(longRes.status, 400);
  });
}
