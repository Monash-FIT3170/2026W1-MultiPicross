import assert from "assert";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { Room as ServerRoom } from "colyseus";
import type { Room as ClientRoom } from "@colyseus/sdk";

// src/db/client.ts reads these at import time, so they must be in place before
// the dynamic imports in before(). CI sets them; these mirror compose defaults.
process.env.DB_HOST ??= "localhost";
process.env.DB_USER ??= "picross";
process.env.DB_PASSWORD ??= "picross";
process.env.DB_NAME ??= "picross";

// A 3x3 fixture, a size the UI never offers (5/10/15/20), so the room's
// `ORDER BY RANDOM()` pick is deterministic even against a populated bank:
//
//   # . #      filled: 0 2 4 6 8
//   . # .      empty:  1 3 5 7
//   # . #
const PUZZLE_ID = "test-picross-room-3x3";
const SOLUTION = [1, 0, 1, 0, 1, 0, 1, 0, 1];
const ROW_CLUES = [[1, 1], [1], [1, 1]];
const COL_CLUES = [[1, 1], [1], [1, 1]];
const COLORS = Array(9).fill("#3d5a80");
const EMPTY_CELLS = [
  [0, 1],
  [1, 0],
  [1, 2],
];

/** The postgres.js client, typed without importing it for its side effects. */
type SqlClient = (typeof import("../src/db/client.js"))["sql"];

interface PlayerView {
  username: string;
  confirmedFilled: boolean[];
  crosses: boolean[];
  revealedEmpty: boolean[];
  livesLeft: number;
  done: boolean;
  won: boolean;
  connected: boolean;
}

interface Snapshot {
  phase: "waiting" | "playing" | "finished";
  inviteCode: string;
  width: number;
  height: number;
  rowClues: number[][];
  colClues: number[][];
  players: Record<string, PlayerView>;
  winnerId: string;
  forfeit: boolean;
  colors?: string[];
}

// Follows one client's snapshot stream. Waiting on content rather than on
// "the next message" keeps assertions immune to how many broadcasts an
// action happens to produce.
function track(client: ClientRoom) {
  let latest: Snapshot | null = null;
  const waiters: Array<(s: Snapshot) => void> = [];

  client.onMessage("state", (msg: Snapshot) => {
    latest = msg;
    for (const notify of waiters.splice(0)) notify(msg);
  });

  return {
    /** Resolves as soon as some snapshot — current or future — matches. */
    wait(
      predicate: (s: Snapshot) => boolean,
      what: string,
      timeout = 3000,
    ): Promise<Snapshot> {
      if (latest && predicate(latest)) return Promise.resolve(latest);
      return new Promise<Snapshot>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`timed out waiting for ${what}`)),
          timeout,
        );
        const notify = (s: Snapshot) => {
          if (!predicate(s)) {
            waiters.push(notify);
            return;
          }
          clearTimeout(timer);
          resolve(s);
        };
        waiters.push(notify);
      });
    },
  };
}

function fill(client: ClientRoom, [row, col]: number[]) {
  client.send("fill", { row, col });
}

describe("PicrossRoom", () => {
  let colyseus: ColyseusTestServer;
  let sql: SqlClient;
  let dbReady = false;

  before(async function () {
    this.timeout(30000);

    sql = (await import("../src/db/client.js")).sql;

    try {
      // The gameserver CI job gets a Postgres service but not the api's
      // migrations, so the suite provisions the one table it needs.
      await sql`
        CREATE TABLE IF NOT EXISTS nonograms (
          id text PRIMARY KEY NOT NULL,
          width smallint NOT NULL,
          height smallint NOT NULL,
          solution jsonb NOT NULL,
          row_clues jsonb NOT NULL,
          col_clues jsonb NOT NULL,
          colors jsonb NOT NULL,
          created_at timestamp DEFAULT now() NOT NULL
        )
      `;
      await sql`
        INSERT INTO nonograms (id, width, height, solution, row_clues, col_clues, colors)
        VALUES (
          ${PUZZLE_ID}, 3, 3,
          ${sql.json(SOLUTION)},
          ${sql.json(ROW_CLUES)},
          ${sql.json(COL_CLUES)},
          ${sql.json(COLORS)}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      dbReady = true;
    } catch (err) {
      // CI must have a database — fail loudly there. Locally, a developer
      // without Postgres running should not see a red suite for it.
      if (process.env.CI) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`\n    (skipping PicrossRoom suite — no database: ${msg})`);
      this.skip();
    }

    // onCreate picks with ORDER BY RANDOM(), so 3x3 must belong to the fixture
    // alone for these tests to be deterministic.
    const foreign = await sql`
      SELECT id FROM nonograms
      WHERE width = 3 AND height = 3 AND id <> ${PUZZLE_ID}
    `;
    assert.strictEqual(
      foreign.length,
      0,
      `these tests reserve 3x3 for their fixture, but the database holds ${foreign.length} other 3x3 puzzle(s)`,
    );

    const { boot } = await import("@colyseus/testing");
    const appConfig = (await import("../src/app.config.js")).default;
    colyseus = await boot(appConfig);
  });

  after(async () => {
    if (colyseus) await colyseus.shutdown();
    if (dbReady) await sql`DELETE FROM nonograms WHERE id = ${PUZZLE_ID}`;
  });

  beforeEach(async () => await colyseus.cleanup());

  /** Boots a room with both seats filled and the match under way. */
  async function startMatch() {
    const room: ServerRoom = await colyseus.createRoom("picross_room", {
      width: 3,
      height: 3,
    });
    const clientA = await colyseus.connectTo(room, { username: "A" });
    const seenByA = track(clientA);
    const clientB = await colyseus.connectTo(room, { username: "B" });
    // B's stream is not asserted on, but registering a handler keeps the SDK
    // from warning about unhandled "state" messages on every broadcast.
    const seenByB = track(clientB);

    const snapshot = await seenByA.wait(
      (s) => s.phase === "playing",
      "the match to start",
    );
    assert.deepStrictEqual(snapshot.rowClues, ROW_CLUES, "unexpected puzzle");

    return {
      room,
      clientA,
      clientB,
      seenByA,
      seenByB,
      aId: clientA.sessionId,
      bId: clientB.sessionId,
    };
  }

  // ── D1 ─────────────────────────────────────────────────────────────────────

  it("does not crown an eliminated player when the opponent leaves", async () => {
    const { clientA, clientB, seenByA, aId } = await startMatch();

    // A burns all three lives, but the match keeps going: B is still alive.
    for (const cell of EMPTY_CELLS) fill(clientA, cell);
    const eliminated = await seenByA.wait(
      (s) => s.players[aId].livesLeft === 0,
      "A to run out of lives",
    );
    assert.strictEqual(eliminated.players[aId].done, true);
    assert.strictEqual(eliminated.phase, "playing");

    // B closes the tab. A already lost — a forfeit must not hand them the win.
    await clientB.leave();
    const final = await seenByA.wait(
      (s) => s.phase === "finished",
      "the match to end",
    );

    assert.strictEqual(final.forfeit, true);
    assert.notStrictEqual(final.winnerId, aId);
    assert.strictEqual(final.winnerId, "");
  });

  it("awards a forfeit win to an opponent who is still alive", async () => {
    const { clientB, seenByA, aId } = await startMatch();

    await clientB.leave();
    const final = await seenByA.wait(
      (s) => s.phase === "finished",
      "the match to end",
    );

    assert.strictEqual(final.forfeit, true);
    assert.strictEqual(final.winnerId, aId);
  });

  // ── D4 ─────────────────────────────────────────────────────────────────────

  it("holds the seat instead of forfeiting on an unconsented drop", async () => {
    const { clientB, seenByA, bId } = await startMatch();

    // consented=false closes the socket without a leave message — what a wifi
    // blip looks like to the server.
    void clientB.leave(false);
    const snapshot = await seenByA.wait(
      (s) => s.players[bId]?.connected === false,
      "the drop to reach the opponent",
    );

    assert.strictEqual(snapshot.phase, "playing");
    assert.strictEqual(snapshot.winnerId, "");
    assert.strictEqual(snapshot.forfeit, false);
    assert.strictEqual(snapshot.players[bId].connected, false);
  });

  // ── D5 ─────────────────────────────────────────────────────────────────────

  it("issues invite codes that match the shared alphabet", async () => {
    const { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } =
      await import("../src/rooms/PicrossRoom.js");
    const pattern = new RegExp(
      `^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`,
    );

    const roomA: ServerRoom = await colyseus.createRoom("picross_room", {
      width: 3,
      height: 3,
    });
    const roomB: ServerRoom = await colyseus.createRoom("picross_room", {
      width: 3,
      height: 3,
    });

    const codeA = roomA.metadata?.inviteCode as string;
    const codeB = roomB.metadata?.inviteCode as string;

    assert.match(codeA, pattern);
    assert.match(codeB, pattern);
    assert.notStrictEqual(codeA, codeB);
  });

  // ── D6 ─────────────────────────────────────────────────────────────────────

  it("answers 404, not 500, when the bank has no puzzle that size", async () => {
    // 7x7 is a valid request the fixture bank cannot satisfy, so onCreate's
    // typed ServerError has to survive matchMaker and reach the handler.
    const res = await colyseus.http
      .post("/create-room?width=7&height=7")
      .catch((err: { statusCode?: number; data?: unknown }) => err);

    assert.strictEqual(res.statusCode, 404);
    assert.deepStrictEqual(res.data, {
      error: "No puzzle available at 7x7",
    });
  });
});
