process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { checkTestDb } from "./support/db.js";

const { ready, reason } = await checkTestDb();

if (!ready) {
  test("identity upsert integration", { skip: reason }, () => {});
} else {
  const { db, pgClient } = await import("../src/db/client.js");
  const { accounts, identities } = await import("../src/db/schema.js");
  const { and, eq, gte, inArray, isNull } = await import("drizzle-orm");
  const { upsertSsoIdentity } = await import("../src/auth/routes.js");

  const TEST_PROVIDER = "test-identity-upsert";
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

  test("first callback creates one accounts row and one identities row", async () => {
    const subject = crypto.randomUUID();
    const accountId = await upsertSsoIdentity({
      provider: TEST_PROVIDER,
      subject,
      issuer: "http://issuer.example",
    });
    createdAccountIds.push(accountId);

    const accountRows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId));
    assert.equal(accountRows.length, 1);
    assert.equal(accountRows[0].kind, "sso");

    const identityRows = await db
      .select()
      .from(identities)
      .where(eq(identities.subject, subject));
    assert.equal(identityRows.length, 1);
    assert.equal(identityRows[0].accountId, accountId);
    assert.equal(identityRows[0].provider, TEST_PROVIDER);
  });

  test("a second callback with the same anchor reuses the account and preserves the handle", async () => {
    const subject = crypto.randomUUID();
    const firstId = await upsertSsoIdentity({
      provider: TEST_PROVIDER,
      subject,
      issuer: "http://issuer.example",
    });
    createdAccountIds.push(firstId);

    const chosenHandle = `handle-${subject.slice(0, 8)}`;
    await db
      .update(accounts)
      .set({ handle: chosenHandle })
      .where(eq(accounts.id, firstId));

    const secondId = await upsertSsoIdentity({
      provider: TEST_PROVIDER,
      subject,
      issuer: "http://issuer.example",
    });
    assert.equal(secondId, firstId);

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, firstId));
    assert.equal(account.handle, chosenHandle);

    const identityRows = await db
      .select()
      .from(identities)
      .where(eq(identities.subject, subject));
    assert.equal(
      identityRows.length,
      1,
      "must not create a second account for a returning user",
    );
  });

  test("a different anchor yields a different account", async () => {
    const idA = await upsertSsoIdentity({
      provider: TEST_PROVIDER,
      subject: crypto.randomUUID(),
      issuer: "http://issuer.example",
    });
    const idB = await upsertSsoIdentity({
      provider: TEST_PROVIDER,
      subject: crypto.randomUUID(),
      issuer: "http://issuer.example",
    });
    createdAccountIds.push(idA, idB);
    assert.notEqual(idA, idB);
  });

  test("a concurrent duplicate insert returns the same accountId, not a second account", async () => {
    const subject = crypto.randomUUID();
    const since = new Date(Date.now() - 5000);
    const [idA, idB] = await Promise.all([
      upsertSsoIdentity({
        provider: TEST_PROVIDER,
        subject,
        issuer: "http://issuer.example",
      }),
      upsertSsoIdentity({
        provider: TEST_PROVIDER,
        subject,
        issuer: "http://issuer.example",
      }),
    ]);
    createdAccountIds.push(idA);
    assert.equal(idA, idB);

    const identityRows = await db
      .select()
      .from(identities)
      .where(eq(identities.subject, subject));
    assert.equal(identityRows.length, 1);

    // The identity count alone would still pass if the losing racer left an
    // account behind with no identity, which is what a non-atomic insert does.
    const orphans = await db
      .select({ id: accounts.id })
      .from(accounts)
      .leftJoin(identities, eq(identities.accountId, accounts.id))
      .where(
        and(
          eq(accounts.kind, "sso"),
          gte(accounts.createdAt, since),
          isNull(identities.id),
        ),
      );
    createdAccountIds.push(...orphans.map((o) => o.id));
    assert.deepEqual(orphans, []);
  });
}
