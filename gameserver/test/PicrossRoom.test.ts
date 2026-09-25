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
  /** Present only in the snapshot sent to this player's own client. */
  confirmedFilled?: boolean[];
  crosses?: boolean[];
  revealedEmpty?: boolean[];
  mistakeCross?: boolean[];
  livesLeft: number;
  done: boolean;
  won: boolean;
  connected: boolean;
  team: number | null;
  progress: number;
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
  mode: string;
  finishOrder: string[];
}

const FILLED_CELLS = [
  [0, 0],
  [0, 2],
  [1, 1],
  [2, 0],
  [2, 2],
];

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

  it("ends a 1v1 match immediately once one player completes the puzzle, even though the other hasn't finished", async () => {
    const { clientA, seenByB, aId, bId } = await startMatch();

    for (const cell of FILLED_CELLS) fill(clientA, cell);
    const final = await seenByB.wait(
      (s) => s.phase === "finished",
      "the match to end once A finishes",
    );

    assert.strictEqual(final.winnerId, aId);
    assert.strictEqual(final.players[aId].won, true);
    assert.strictEqual(final.players[bId].won, false);
    assert.strictEqual(final.forfeit, false);
  });

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

  // ── Game modes ───────────────────────────────────────────────────────────

  it("defaults to 1v1 when no mode is given", async () => {
    const room: ServerRoom = await colyseus.createRoom("picross_room", {
      width: 3,
      height: 3,
    });

    assert.strictEqual(room.metadata?.mode, "1v1");
    assert.strictEqual(room.maxClients, 2);
  });

  it("falls back to 1v1 when an invalid mode is requested at room-creation time", async () => {
    const room: ServerRoom = await colyseus.createRoom("picross_room", {
      width: 3,
      height: 3,
      mode: "5v5",
    });

    assert.strictEqual(room.metadata?.mode, "1v1");
    assert.strictEqual(room.maxClients, 2);
  });

  it("rejects an invalid mode on /create-room with a 400", async () => {
    const res = await colyseus.http
      .post("/create-room?width=3&height=3&mode=5v5")
      .catch((err: { statusCode?: number; data?: unknown }) => err);

    assert.strictEqual(res.statusCode, 400);
  });

  it("passes mode through /create-room and does not start until the room is full", async () => {
    const created = await colyseus.http.post(
      "/create-room?width=3&height=3&mode=1v1v1v1",
    );
    const roomId = (created.data as { roomId: string }).roomId;
    const room = colyseus.getRoomById<ServerRoom>(roomId);

    assert.strictEqual(room.metadata?.mode, "1v1v1v1");
    assert.strictEqual(room.maxClients, 4);

    const clientA = await colyseus.connectTo(room, { username: "A" });
    const seenByA = track(clientA);
    const clientB = await colyseus.connectTo(room, { username: "B" });
    track(clientB);
    const clientC = await colyseus.connectTo(room, { username: "C" });
    track(clientC);

    // 3/4 players joined — the room must not have started yet.
    const stillWaiting = await seenByA.wait(
      (s) => Object.keys(s.players).length === 3,
      "the third player to be reflected in the snapshot",
    );
    assert.strictEqual(stillWaiting.phase, "waiting");

    const clientD = await colyseus.connectTo(room, { username: "D" });
    track(clientD);

    const started = await seenByA.wait(
      (s) => s.phase === "playing",
      "the match to start once the 4th player joins",
    );
    assert.strictEqual(Object.keys(started.players).length, 4);
    assert.strictEqual(started.mode, "1v1v1v1");
  });

  it("lists mode in /public-rooms", async () => {
    await colyseus.http.post(
      "/create-room?width=3&height=3&mode=1v1v1v1&public=true",
    );

    const res = await colyseus.http.get("/public-rooms");
    const rooms = res.data as Array<{ mode?: string }>;

    assert.ok(rooms.some((r) => r.mode === "1v1v1v1"));
  });

  // ── FFA race semantics ───────────────────────────────────────────────────

  /** Boots a 1v1v1 room with all three seats filled and the match under way. */
  async function startTriMatch() {
    const room: ServerRoom = await colyseus.createRoom("picross_room", {
      width: 3,
      height: 3,
      mode: "1v1v1",
    });
    const clientA = await colyseus.connectTo(room, { username: "A" });
    const seenByA = track(clientA);
    const clientB = await colyseus.connectTo(room, { username: "B" });
    const seenByB = track(clientB);
    const clientC = await colyseus.connectTo(room, { username: "C" });
    const seenByC = track(clientC);

    await seenByA.wait((s) => s.phase === "playing", "the match to start");

    return {
      room,
      clientA,
      clientB,
      clientC,
      seenByA,
      seenByB,
      seenByC,
      aId: clientA.sessionId,
      bId: clientB.sessionId,
      cId: clientC.sessionId,
    };
  }

  it("does not end a 1v1v1 match when the first player finishes", async () => {
    const { clientA, seenByA, seenByB, aId } = await startTriMatch();

    for (const cell of FILLED_CELLS) fill(clientA, cell);

    const snapshot = await seenByB.wait(
      (s) => s.players[aId]?.won === true,
      "A to finish",
    );

    assert.strictEqual(snapshot.phase, "playing");
    assert.strictEqual(snapshot.winnerId, aId);
    assert.deepStrictEqual(snapshot.finishOrder, [aId]);

    // Sanity: A's own stream agrees the match is still live.
    await seenByA.wait((s) => s.phase === "playing", "match still playing");
  });

  it("ends a 1v1v1 match once every player has won or been eliminated, tracking finish order", async () => {
    const { clientA, clientB, clientC, seenByA, seenByC, aId, bId, cId } =
      await startTriMatch();

    // A finishes first, B finishes second.
    for (const cell of FILLED_CELLS) fill(clientA, cell);
    await seenByA.wait((s) => s.players[aId]?.won === true, "A to finish");
    for (const cell of FILLED_CELLS) fill(clientB, cell);
    await seenByA.wait((s) => s.players[bId]?.won === true, "B to finish");

    // C burns all three lives instead of finishing.
    for (const cell of EMPTY_CELLS) fill(clientC, cell);
    const final = await seenByC.wait(
      (s) => s.phase === "finished",
      "the match to end once C is eliminated",
    );

    assert.strictEqual(final.winnerId, aId, "first finisher stays the winner");
    assert.deepStrictEqual(final.finishOrder, [aId, bId]);
    assert.strictEqual(final.players[cId].won, false);
    assert.strictEqual(final.forfeit, false);
  });

  it("continues a 1v1v1 match when one player leaves and two remain active", async () => {
    const { clientA, seenByB, bId, cId } = await startTriMatch();

    await clientA.leave();

    const snapshot = await seenByB.wait(
      (s) => Object.keys(s.players).length === 2,
      "A's departure to be reflected",
    );

    assert.strictEqual(snapshot.phase, "playing");
    assert.strictEqual(snapshot.winnerId, "");
    assert.ok(snapshot.players[bId]);
    assert.ok(snapshot.players[cId]);
  });

  it("declares the sole remaining player the winner once the other two have left", async () => {
    const { clientA, clientB, seenByC, cId } = await startTriMatch();

    await clientA.leave();
    await clientB.leave();

    const final = await seenByC.wait(
      (s) => s.phase === "finished",
      "the match to end once only C remains",
    );

    assert.strictEqual(final.forfeit, true);
    assert.strictEqual(final.winnerId, cId);
    assert.strictEqual(final.players[cId].won, true);
  });

  it("does not auto-win a sole active player who was left standing by elimination rather than a leave", async () => {
    const {
      clientA,
      clientB,
      clientC,
      seenByA,
      seenByB,
      seenByC,
      aId,
      bId,
      cId,
    } = await startTriMatch();

    // A and B both burn all their lives; nobody leaves. C is the only one
    // left standing, but elimination alone (with nobody having left) must
    // never auto-win the match for them — they still have to finish.
    for (const cell of EMPTY_CELLS) fill(clientA, cell);
    await seenByA.wait((s) => s.players[aId]?.livesLeft === 0, "A eliminated");
    for (const cell of EMPTY_CELLS) fill(clientB, cell);
    const stillPlaying = await seenByB.wait(
      (s) => s.players[bId]?.livesLeft === 0,
      "B eliminated",
    );

    assert.strictEqual(stillPlaying.phase, "playing");
    assert.strictEqual(stillPlaying.winnerId, "");
    assert.strictEqual(stillPlaying.players[cId].done, false);

    // C finishes the puzzle themselves — nothing auto-decided it for them.
    for (const cell of FILLED_CELLS) fill(clientC, cell);
    const final = await seenByC.wait(
      (s) => s.phase === "finished",
      "C to finish and end the match",
    );

    assert.strictEqual(final.winnerId, cId);
    assert.strictEqual(final.forfeit, false);
  });

  // ── 2v2 teams ────────────────────────────────────────────────────────────

  /** Boots a 2v2 room with all four seats filled and the match under way. */
  async function startSquadMatch() {
    const room: ServerRoom = await colyseus.createRoom("picross_room", {
      width: 3,
      height: 3,
      mode: "2v2",
    });
    const clientA = await colyseus.connectTo(room, { username: "A" });
    const seenByA = track(clientA);
    const clientB = await colyseus.connectTo(room, { username: "B" });
    const seenByB = track(clientB);
    const clientC = await colyseus.connectTo(room, { username: "C" });
    const seenByC = track(clientC);
    const clientD = await colyseus.connectTo(room, { username: "D" });
    const seenByD = track(clientD);

    await seenByA.wait((s) => s.phase === "playing", "the match to start");

    return {
      room,
      clientA,
      clientB,
      clientC,
      clientD,
      seenByA,
      seenByB,
      seenByC,
      seenByD,
      aId: clientA.sessionId,
      bId: clientB.sessionId,
      cId: clientC.sessionId,
      dId: clientD.sessionId,
    };
  }

  it("assigns the 1st and 2nd joiners to Team 1 and the 3rd and 4th to Team 2", async () => {
    const { seenByA, aId, bId, cId, dId } = await startSquadMatch();

    const snapshot = await seenByA.wait(
      (s) => s.phase === "playing",
      "the match to start",
    );

    assert.strictEqual(snapshot.players[aId].team, 0);
    assert.strictEqual(snapshot.players[bId].team, 0);
    assert.strictEqual(snapshot.players[cId].team, 1);
    assert.strictEqual(snapshot.players[dId].team, 1);
  });

  it("recomputes team assignment when a player leaves before the room is full", async () => {
    const room: ServerRoom = await colyseus.createRoom("picross_room", {
      width: 3,
      height: 3,
      mode: "2v2",
    });
    const clientA = await colyseus.connectTo(room, { username: "A" });
    const seenByA = track(clientA);
    const clientB = await colyseus.connectTo(room, { username: "B" });
    track(clientB);

    // B leaves before the room fills — pre-match, so no forfeit logic
    // applies, just a seat opening back up.
    await clientB.leave();
    await seenByA.wait(
      (s) => Object.keys(s.players).length === 1,
      "B's departure to be reflected",
    );

    const clientC = await colyseus.connectTo(room, { username: "C" });
    track(clientC);
    const clientD = await colyseus.connectTo(room, { username: "D" });
    track(clientD);
    const clientE = await colyseus.connectTo(room, { username: "E" });
    track(clientE);

    const started = await seenByA.wait(
      (s) => s.phase === "playing",
      "the match to start once refilled",
    );

    // Reshuffled order is A, C, D, E (B's slot was simply removed, not held
    // open) — so A+C are Team 1 and D+E are Team 2.
    assert.strictEqual(started.players[clientA.sessionId].team, 0);
    assert.strictEqual(started.players[clientC.sessionId].team, 0);
    assert.strictEqual(started.players[clientD.sessionId].team, 1);
    assert.strictEqual(started.players[clientE.sessionId].team, 1);
  });

  it("ends a 2v2 match immediately once either team member finishes", async () => {
    const { clientB, seenByA, seenByC, aId, bId, cId, dId } =
      await startSquadMatch();

    // B (Team 1, alongside A) finishes — the match ends for everyone even
    // though A, C, and D haven't made any progress.
    for (const cell of FILLED_CELLS) fill(clientB, cell);

    const final = await seenByC.wait(
      (s) => s.phase === "finished",
      "the match to end once B finishes",
    );

    assert.strictEqual(final.winnerId, bId);
    assert.strictEqual(final.players[bId].won, true);
    assert.strictEqual(final.players[aId].won, false);
    assert.strictEqual(final.players[cId].won, false);
    assert.strictEqual(final.players[dId].won, false);
  });

  it("keeps a team alive when only one of its members leaves", async () => {
    const { clientA, seenByB, bId, cId, dId } = await startSquadMatch();

    // A (Team 1) leaves; B (A's teammate) is still active, so Team 1 is not
    // eliminated and the match continues normally.
    await clientA.leave();

    const snapshot = await seenByB.wait(
      (s) => Object.keys(s.players).length === 3,
      "A's departure to be reflected",
    );

    assert.strictEqual(snapshot.phase, "playing");
    assert.strictEqual(snapshot.winnerId, "");
    assert.ok(snapshot.players[bId]);
    assert.ok(snapshot.players[cId]);
    assert.ok(snapshot.players[dId]);
  });

  it("auto-wins the surviving team once the opposing team is fully wiped out by leaving", async () => {
    const { clientA, clientB, seenByC, cId } = await startSquadMatch();

    // Both members of Team 1 leave — Team 2 (C, D) auto-wins without
    // needing to finish.
    await clientA.leave();
    await clientB.leave();

    const final = await seenByC.wait(
      (s) => s.phase === "finished",
      "the match to end once Team 1 is wiped out",
    );

    assert.strictEqual(final.forfeit, true);
    assert.ok(
      final.winnerId === cId || final.players[final.winnerId]?.team === 1,
    );
    assert.strictEqual(final.players[final.winnerId].won, true);
  });

  it("auto-wins the surviving team once the opposing team is fully eliminated by lives, with no leave involved", async () => {
    const { clientA, clientB, clientC, seenByA, seenByB, seenByD, dId } =
      await startSquadMatch();

    // Both members of Team 1 (A, B) burn all their lives; nobody leaves.
    // Team 2 (C, D) auto-wins immediately — unlike FFA, elimination alone
    // is enough to end a 2v2 match once a whole team is wiped out.
    for (const cell of EMPTY_CELLS) fill(clientA, cell);
    await seenByA.wait(
      (s) => s.players[clientA.sessionId]?.livesLeft === 0,
      "A eliminated",
    );
    for (const cell of EMPTY_CELLS) fill(clientB, cell);

    const final = await seenByD.wait(
      (s) => s.phase === "finished",
      "the match to end once Team 1 is fully eliminated",
    );

    assert.strictEqual(final.forfeit, false);
    assert.strictEqual(final.players[final.winnerId].team, 1);
    assert.strictEqual(final.players[final.winnerId].won, true);
    assert.ok(final.winnerId === dId || final.winnerId === clientC.sessionId);
  });

  // ── Progress-bar visibility (per-client snapshot scoping) ───────────────

  it("only includes board arrays for a client's own player, not for others", async () => {
    const { clientA, seenByA, seenByB, aId, bId } = await startMatch();

    fill(clientA, FILLED_CELLS[0]);
    const fromA = await seenByA.wait(
      (s) => s.players[aId]?.confirmedFilled?.[0] === true,
      "A's own fill to appear in A's snapshot",
    );

    // A's own entry carries full board data.
    assert.ok(Array.isArray(fromA.players[aId].confirmedFilled));
    assert.ok(Array.isArray(fromA.players[aId].crosses));
    assert.ok(Array.isArray(fromA.players[aId].revealedEmpty));
    assert.ok(Array.isArray(fromA.players[aId].mistakeCross));

    // B's entry, as seen by A, carries none of that — aggregated data only.
    assert.strictEqual(fromA.players[bId].confirmedFilled, undefined);
    assert.strictEqual(fromA.players[bId].crosses, undefined);
    assert.strictEqual(fromA.players[bId].revealedEmpty, undefined);
    assert.strictEqual(fromA.players[bId].mistakeCross, undefined);

    // Symmetric from B's point of view: B's own board is present, A's isn't.
    const fromB = await seenByB.wait(
      (s) => s.players[aId] !== undefined,
      "a snapshot to reach B",
    );
    assert.ok(Array.isArray(fromB.players[bId].confirmedFilled));
    assert.strictEqual(fromB.players[aId].confirmedFilled, undefined);
  });

  it("computes progress as the fraction of filled cells correctly filled", async () => {
    const { clientA, seenByA, seenByB, aId } = await startMatch();

    assert.strictEqual(
      (
        await seenByB.wait(
          (s) => s.players[aId] !== undefined,
          "initial snapshot",
        )
      ).players[aId].progress,
      0,
    );

    fill(clientA, FILLED_CELLS[0]);
    const afterOne = await seenByB.wait(
      (s) => s.players[aId]?.progress > 0,
      "A's progress to update after one fill",
    );
    // 1 of 5 filled cells in the 3x3 fixture.
    assert.strictEqual(afterOne.players[aId].progress, 1 / 5);

    for (const cell of FILLED_CELLS.slice(1)) fill(clientA, cell);
    const finished = await seenByB.wait(
      (s) => s.phase === "finished",
      "A to finish",
    );
    assert.strictEqual(finished.players[aId].progress, 1);
  });

  it("keeps other players' board data hidden even after the match ends", async () => {
    const { clientA, seenByB, aId } = await startMatch();

    for (const cell of FILLED_CELLS) fill(clientA, cell);
    const final = await seenByB.wait(
      (s) => s.phase === "finished",
      "the match to end",
    );

    // B's own view of the finished match still has no board data for A.
    assert.strictEqual(final.players[aId].confirmedFilled, undefined);
    assert.strictEqual(final.players[aId].crosses, undefined);
    assert.strictEqual(final.players[aId].progress, 1);
    // The solved-board reveal (colors) is unrelated to per-player board
    // data and is unaffected by this change.
    assert.ok(Array.isArray(final.colors));
  });
});
