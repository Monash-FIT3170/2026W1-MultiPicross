process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { checkTestDb } from "./support/db.js";

const { ready, reason } = await checkTestDb();

if (!ready) {
  test("refresh token prune integration", { skip: reason }, () => {});
} else {
  const { db, pgClient } = await import("../src/db/client.js");
  const { accounts, refreshTokens } = await import("../src/db/schema.js");
  const { inArray, eq } = await import("drizzle-orm");
  const { pruneRefreshTokens } = await import("../src/auth/routes.js");

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

  test("prunes expired rows and leaves live ones alone", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ kind: "sso" })
      .returning({ id: accounts.id });
    createdAccountIds.push(account.id);

    const expired = crypto.randomUUID();
    const live = crypto.randomUUID();
    await db.insert(refreshTokens).values([
      {
        id: expired,
        accountId: account.id,
        tokenHash: "expired",
        expiresAt: new Date(Date.now() - 1000),
      },
      {
        id: live,
        accountId: account.id,
        tokenHash: "live",
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);

    await pruneRefreshTokens();

    const remaining = await db
      .select({ id: refreshTokens.id })
      .from(refreshTokens)
      .where(eq(refreshTokens.accountId, account.id));
    assert.deepEqual(
      remaining.map((r) => r.id),
      [live],
    );
  });
}
