export interface DbCheck {
  ready: boolean;
  reason: string;
}

// Imports db/client.js lazily: that module reads DB_HOST etc. at import time
// with no fallback, so importing it before checking the env vars would throw
// instead of letting the caller skip cleanly.
export async function checkTestDb(): Promise<DbCheck> {
  if (!(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME)) {
    return {
      ready: false,
      reason:
        "DB_HOST/DB_USER/DB_NAME are not set; skipping DB integration tests",
    };
  }
  try {
    const { db } = await import("../../src/db/client.js");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`select 1`);
    return { ready: true, reason: "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Close the pool on failure too, so a refused connection doesn't leave a
    // socket open that keeps the test runner from exiting.
    const { pgClient } = await import("../../src/db/client.js");
    await pgClient.end({ timeout: 1 }).catch(() => {});
    return {
      ready: false,
      reason: `database is not reachable; skipping DB integration tests (${message})`,
    };
  }
}
