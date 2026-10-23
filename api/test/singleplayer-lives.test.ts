process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { checkTestDb } from "./support/db.js";

const { ready, reason } = await checkTestDb();

if (!ready) {
  test("singleplayer lives integration", { skip: reason }, () => {});
} else {
  const { db, pgClient } = await import("../src/db/client.js");
  const { accounts, nonograms } = await import("../src/db/schema.js");
  const { inArray, eq } = await import("drizzle-orm");
  const { Hono } = await import("hono");
  const { default: spRoutes } = await import("../src/singleplayer/routes.js");
  const { signAccessToken } = await import("../src/auth/helpers.js");
  const { ACCESS_COOKIE, CSRF_COOKIE } = await import("../src/auth/cookies.js");

  const app = new Hono().route("/singleplayer", spRoutes);
  const createdAccountIds: string[] = [];

  // A 1x4 puzzle (an unusual size, so /start can only pick this one) with the
  // top cell filled. Every other cell is a mistake to fill.
  const PUZZLE_ID = "test-singleplayer-lives";
  const WIDTH = 1;
  const HEIGHT = 4;

  async function cleanup(): Promise<void> {
    if (createdAccountIds.length > 0) {
      await db.delete(accounts).where(inArray(accounts.id, createdAccountIds));
      createdAccountIds.length = 0;
    }
    await db.delete(nonograms).where(eq(nonograms.id, PUZZLE_ID));
  }

  before(async () => {
    await cleanup();
    await db.insert(nonograms).values({
      id: PUZZLE_ID,
      width: WIDTH,
      height: HEIGHT,
      solution: [1, 0, 0, 0],
      rowClues: [[1], [], [], []],
      colClues: [[1]],
      colors: ["#000000", "#ffffff", "#ffffff", "#ffffff"],
    });
  });
  after(cleanup);
  after(() => pgClient.end({ timeout: 1 }));

  async function newAccountCookie(): Promise<string> {
    const [account] = await db
      .insert(accounts)
      .values({ kind: "sso" })
      .returning({ id: accounts.id });
    createdAccountIds.push(account.id);
    const token = await signAccessToken({ sub: account.id });
    return `${ACCESS_COOKIE}=${token}; ${CSRF_COOKIE}=csrf`;
  }

  function post(cookie: string, path: string, body: unknown) {
    return app.request(`/singleplayer${path}`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": "csrf",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  async function fillMistakes(cookie: string) {
    const results = [];
    for (let row = 1; row < HEIGHT; row++) {
      const res = await post(cookie, "/action", { row, col: 0, kind: "fill" });
      assert.equal(res.status, 200);
      results.push(
        (await res.json()) as { livesLeft: number; gameOver: boolean },
      );
    }
    return results;
  }

  test("lives default to on and three mistakes end the game", async () => {
    const cookie = await newAccountCookie();
    const start = await post(cookie, "/start", {
      width: WIDTH,
      height: HEIGHT,
    });
    const { completion } = (await start.json()) as {
      completion: { livesEnabled: boolean; livesLeft: number };
    };
    assert.equal(completion.livesEnabled, true);

    const results = await fillMistakes(cookie);
    assert.deepEqual(
      results.map((r) => [r.livesLeft, r.gameOver]),
      [
        [2, false],
        [1, false],
        [0, true],
      ],
    );
  });

  test("with lives off, mistakes cost nothing and never end the game", async () => {
    const cookie = await newAccountCookie();
    const start = await post(cookie, "/start", {
      width: WIDTH,
      height: HEIGHT,
      livesEnabled: false,
    });
    const { completion } = (await start.json()) as {
      completion: { livesEnabled: boolean };
    };
    assert.equal(completion.livesEnabled, false);

    const results = await fillMistakes(cookie);
    assert.ok(results.every((r) => r.livesLeft === 3 && !r.gameOver));

    // The game is still playable and remembers lives are off when resumed.
    const active = await app.request("/singleplayer/active", {
      headers: { Cookie: cookie },
    });
    const body = (await active.json()) as {
      completion: { livesEnabled: boolean; revealedEmpty: boolean[] };
    };
    assert.equal(body.completion.livesEnabled, false);
    assert.deepEqual(body.completion.revealedEmpty, [false, true, true, true]);
  });

  async function clearWithoutMistakes(livesEnabled: boolean) {
    const cookie = await newAccountCookie();
    await post(cookie, "/start", {
      width: WIDTH,
      height: HEIGHT,
      livesEnabled,
    });
    const res = await post(cookie, "/action", { row: 0, col: 0, kind: "fill" });
    assert.equal(res.status, 200);
    return (await res.json()) as {
      completed: boolean;
      unlockedAchievements: string[];
    };
  }

  test("a flawless clear with lives on is a perfect clear", async () => {
    const result = await clearWithoutMistakes(true);
    assert.equal(result.completed, true);
    assert.ok(result.unlockedAchievements.includes("sp_perfect_clear"));
  });

  test("a clear with lives off is never a perfect clear", async () => {
    const result = await clearWithoutMistakes(false);
    assert.equal(result.completed, true);
    assert.ok(result.unlockedAchievements.includes("sp_first_clear"));
    assert.ok(!result.unlockedAchievements.includes("sp_perfect_clear"));
  });
}
