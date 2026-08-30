import { Room, Client, ServerError, matchMaker } from "colyseus";
import { PicrossRoomState } from "./schema/PicrossRoomState.js";
import { sql } from "../db/client.js";
import { verifyRoomToken } from "../auth/roomToken.js";
import { requireEnv } from "../env.js";

interface RoomAuth {
  username: string | null;
}

/**
 * Invite-code alphabet: unambiguous characters only (no O/0, no I/1).
 * Exported so app.config.ts can build its validation pattern from this single
 * source instead of hand-copying the character set — the two used to be
 * separate literals that could silently drift apart.
 */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 6;

/**
 * ServerError code thrown by onCreate() when the puzzle bank holds nothing of
 * the requested size. matchMaker's handleCreateRoom() rethrows onCreate
 * failures as `new ServerError(err.code || MATCHMAKE_UNHANDLED, err.message)`,
 * so this code survives the trip out to the /create-room express handler,
 * which turns it into an actionable 404 instead of an opaque 500. Chosen well
 * clear of Colyseus's own ErrorCode (520-526, 4217) and CloseCode ranges.
 */
export const ERR_NO_PUZZLE_FOR_SIZE = 4500;

/** Bounded re-rolls when a freshly generated invite code is already in use. */
const INVITE_CODE_ATTEMPTS = 10;

/**
 * How long a seat is held open after an *unconsented* disconnect (wifi blip,
 * laptop sleep, proxy reset) before the match is forfeited. The client SDK
 * retries with exponential backoff (2^n x 100ms, capped at 5s), so ~8 attempts
 * span roughly this window — see Room.tsx, which caps maxRetries to match.
 */
const RECONNECTION_WINDOW_SECONDS = 20;

function generateCode(): string {
  return Array.from(
    { length: INVITE_CODE_LENGTH },
    () =>
      INVITE_CODE_ALPHABET[
        Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)
      ],
  ).join("");
}

/**
 * After a correct fill, cross out every remaining empty cell in any row or
 * column whose clue total is now satisfied. 0-clue lines satisfy immediately.
 *
 * DUPLICATED, ON PURPOSE: frontend/src/pages/Singleplayer.tsx has the same
 * algorithm over a CellValue[] grid instead of boolean[] pairs. The two must
 * stay in sync — a change here needs the matching change there. They cannot
 * share code: the frontend and gameserver have separate Docker build contexts
 * (see compose.yaml) and this repo has no shared package, so neither can
 * import from the other.
 */
function applyAutoComplete(
  filled: boolean[],
  crosses: boolean[],
  rowClues: number[][],
  colClues: number[][],
  width: number,
  height: number,
): boolean[] {
  const out = [...crosses];
  for (let r = 0; r < height; r++) {
    const needed = rowClues[r].reduce((a, b) => a + b, 0);
    let cnt = 0;
    for (let c = 0; c < width; c++) if (filled[r * width + c]) cnt++;
    if (cnt >= needed) {
      for (let c = 0; c < width; c++) {
        if (!filled[r * width + c]) out[r * width + c] = true;
      }
    }
  }
  for (let c = 0; c < width; c++) {
    const needed = colClues[c].reduce((a, b) => a + b, 0);
    let cnt = 0;
    for (let r = 0; r < height; r++) if (filled[r * width + c]) cnt++;
    if (cnt >= needed) {
      for (let r = 0; r < height; r++) {
        if (!filled[r * width + c]) out[r * width + c] = true;
      }
    }
  }
  return out;
}

interface PlayerData {
  username: string;
  confirmedFilled: boolean[];
  crosses: boolean[];
  revealedEmpty: boolean[];
  livesLeft: number;
  done: boolean;
  won: boolean;
  /** False while the player is inside their reconnection window. */
  connected: boolean;
}

export class PicrossRoom extends Room {
  maxClients = 2;
  state = new PicrossRoomState();

  private players = new Map<string, PlayerData>();
  private solution: number[] = [];
  private rowClues: number[][] = [];
  private colClues: number[][] = [];
  private colors: string[] = [];
  private width = 0;
  private height = 0;
  private winnerId = "";
  private forfeit = false;

  async onCreate(options: {
    width?: number;
    height?: number;
    isPublic?: boolean;
  }) {
    const width = options.width ?? 10;
    const height = options.height ?? 10;

    const rows = await sql`
      SELECT width, height, row_clues, col_clues, solution, colors
      FROM nonograms
      WHERE width = ${width} AND height = ${height}
      ORDER BY RANDOM()
      LIMIT 1
    `;

    if (rows.length === 0) {
      throw new ServerError(
        ERR_NO_PUZZLE_FOR_SIZE,
        `No puzzles found for size ${width}x${height}`,
      );
    }

    const puzzle = rows[0];
    this.width = puzzle.width as number;
    this.height = puzzle.height as number;
    this.solution = puzzle.solution as number[];
    this.rowClues = puzzle.row_clues as number[][];
    this.colClues = puzzle.col_clues as number[][];
    this.colors = puzzle.colors as string[];

    const code = await this.generateUniqueCode();
    this.state.inviteCode = code;

    await this.setMetadata({
      inviteCode: code,
      width: this.width,
      height: this.height,
    });

    if (!options.isPublic) {
      await this.setPrivate(true);
    }

    this.onMessage<{ row: number; col: number }>("fill", (client, msg) => {
      this.handleFill(client.sessionId, msg.row, msg.col);
    });

    this.onMessage<{ row: number; col: number; markCross: boolean }>(
      "cross",
      (client, msg) => {
        this.handleCross(client.sessionId, msg.row, msg.col, msg.markCross);
      },
    );
  }

  /**
   * Invite codes are the lookup key for /room-by-code, so a duplicate silently
   * routes joiners to whichever room the matchmaker happens to find first.
   * Re-roll until the code is free among live rooms. Our own listing is not
   * persisted until onCreate() returns, so this can never match ourselves.
   * Two rooms created in the same tick could still theoretically collide —
   * the retry makes that vanishingly unlikely rather than impossible.
   */
  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < INVITE_CODE_ATTEMPTS; attempt++) {
      const code = generateCode();
      const existing = await matchMaker.query({
        name: this.roomName,
        inviteCode: code,
      });
      if (existing.length === 0) return code;
    }
    throw new Error(
      `Could not allocate a unique invite code after ${INVITE_CODE_ATTEMPTS} attempts`,
    );
  }

  async onAuth(
    _client: Client,
    options: { token?: string },
  ): Promise<RoomAuth> {
    if (!options.token) return { username: null };

    const payload = verifyRoomToken(
      options.token,
      requireEnv("JWT_ROOM_SECRET"),
    );
    if (!payload) {
      throw new ServerError(401, "Invalid or expired room token");
    }
    return { username: payload.username };
  }

  // Trusted (server-verified) identity wins; free-text client input is only
  // ever used as a display name for unauthenticated guests, and even then
  // it's sanitized and de-duplicated against the other player in the room.
  private resolveUsername(client: Client, rawUsername?: string): string {
    const auth = client.auth as RoomAuth | undefined;
    if (auth?.username) return auth.username;

    const trimmed = (rawUsername ?? "").trim().slice(0, 20);
    const base = trimmed.length > 0 ? trimmed : "Guest";
    const taken = new Set([...this.players.values()].map((p) => p.username));
    if (!taken.has(base)) return base;

    let suffix = 2;
    while (taken.has(`${base} (${suffix})`)) suffix++;
    return `${base} (${suffix})`;
  }

  onJoin(client: Client, options: { username?: string }) {
    const cellCount = this.width * this.height;
    const player: PlayerData = {
      username: this.resolveUsername(client, options.username),
      confirmedFilled: Array(cellCount).fill(false),
      crosses: Array(cellCount).fill(false),
      revealedEmpty: Array(cellCount).fill(false),
      livesLeft: 3,
      done: false,
      won: false,
      connected: true,
    };
    this.players.set(client.sessionId, player);

    if (this.players.size === 2) {
      this.setPhase("playing");
    }

    client.send("state", this.buildSnapshot());
    this.broadcast("state", this.buildSnapshot(), { except: client });
  }

  /**
   * Colyseus routes *unconsented* closes (wifi blip, laptop sleep, proxy
   * reset) here rather than to onLeave(). Hold the seat open for a short
   * window instead of ending the match: if the client gets back in time
   * onReconnect() runs and nothing was lost, and if the window expires
   * Colyseus calls onLeave() for us, which applies the forfeit. A deliberate
   * quit still closes with CloseCode.CONSENTED and goes straight to onLeave().
   */
  async onDrop(client: Client) {
    // Only a live match is worth holding a seat for. Outside one, returning
    // here hands the client straight to onLeave(), as a quit would.
    if (this.state.phase !== "playing") return;

    const player = this.players.get(client.sessionId);
    if (player) {
      player.connected = false;
      this.broadcast("state", this.buildSnapshot());
    }

    try {
      await this.allowReconnection(client, RECONNECTION_WINDOW_SECONDS);
    } catch {
      // Window expired (or the room is disposing). Colyseus follows up with
      // onLeave() for this client, so there is nothing to do here.
    }
  }

  onReconnect(client: Client) {
    const player = this.players.get(client.sessionId);
    if (player) player.connected = true;
    // The snapshot travels as a custom "state" message rather than in schema
    // state, so nothing replays it on reconnect — resend it explicitly.
    this.broadcast("state", this.buildSnapshot());
  }

  onLeave(client: Client) {
    if (this.state.phase === "playing") {
      // A forfeit win may only go to a player who is still alive. If the last
      // player standing had already burned all three lives their elimination
      // stands and nobody wins — crowning them was reporting a loss as a win.
      // Never overwrite an already-decided winner either.
      if (!this.winnerId) {
        const survivors = [...this.players.entries()].filter(
          ([sessionId, p]) => sessionId !== client.sessionId && !p.done,
        );
        if (survivors.length === 1) {
          this.winnerId = survivors[0][0];
        }
      }
      this.forfeit = true;
      this.setPhase("finished");
    }
    this.players.delete(client.sessionId);
    this.broadcast("state", this.buildSnapshot());
  }

  // Centralizes the "finished rooms must not be joinable/listed" invariant
  // in one place instead of every phase-transition call site.
  private setPhase(phase: "waiting" | "playing" | "finished") {
    this.state.phase = phase;
    if (phase === "finished") this.lock();
  }

  private handleFill(sessionId: string, row: number, col: number) {
    if (this.state.phase !== "playing") return;
    const player = this.players.get(sessionId);
    if (!player || player.done) return;
    if (row < 0 || row >= this.height || col < 0 || col >= this.width) return;

    const idx = row * this.width + col;
    if (player.confirmedFilled[idx] || player.revealedEmpty[idx]) return;

    if (this.solution[idx] === 1) {
      player.confirmedFilled[idx] = true;
      player.crosses[idx] = false;
      player.crosses = applyAutoComplete(
        player.confirmedFilled,
        player.crosses,
        this.rowClues,
        this.colClues,
        this.width,
        this.height,
      );

      const isComplete = this.solution.every(
        (v, i) => v === 0 || player.confirmedFilled[i],
      );
      if (isComplete) {
        player.done = true;
        player.won = true;
        this.winnerId = sessionId;
        this.setPhase("finished");
      }
    } else {
      player.revealedEmpty[idx] = true;
      player.livesLeft = Math.max(0, player.livesLeft - 1);
      if (player.livesLeft === 0) {
        player.done = true;
        const allDone = [...this.players.values()].every((p) => p.done);
        if (allDone) this.setPhase("finished");
      }
    }

    this.broadcast("state", this.buildSnapshot());
  }

  private handleCross(
    sessionId: string,
    row: number,
    col: number,
    markCross: boolean,
  ) {
    if (this.state.phase !== "playing") return;
    const player = this.players.get(sessionId);
    if (!player || player.done) return;
    if (row < 0 || row >= this.height || col < 0 || col >= this.width) return;

    const idx = row * this.width + col;
    if (player.confirmedFilled[idx] || player.revealedEmpty[idx]) return;

    if (markCross && this.solution[idx] === 1) {
      // Mistaken cross on a filled cell — reveal it and lose a life
      player.confirmedFilled[idx] = true;
      player.crosses[idx] = false;
      player.livesLeft = Math.max(0, player.livesLeft - 1);
      player.crosses = applyAutoComplete(
        player.confirmedFilled,
        player.crosses,
        this.rowClues,
        this.colClues,
        this.width,
        this.height,
      );

      const isComplete = this.solution.every(
        (v, i) => v === 0 || player.confirmedFilled[i],
      );
      if (isComplete) {
        player.done = true;
        player.won = true;
        this.winnerId = sessionId;
        this.setPhase("finished");
      } else if (player.livesLeft === 0) {
        player.done = true;
        const allDone = [...this.players.values()].every((p) => p.done);
        if (allDone) this.setPhase("finished");
      }
    } else {
      player.crosses[idx] = markCross;
    }

    this.broadcast("state", this.buildSnapshot());
  }

  private buildSnapshot() {
    const players: Record<
      string,
      {
        username: string;
        confirmedFilled: boolean[];
        crosses: boolean[];
        revealedEmpty: boolean[];
        livesLeft: number;
        done: boolean;
        won: boolean;
        connected: boolean;
      }
    > = {};

    this.players.forEach((p, id) => {
      players[id] = {
        username: p.username,
        confirmedFilled: [...p.confirmedFilled],
        crosses: [...p.crosses],
        revealedEmpty: [...p.revealedEmpty],
        livesLeft: p.livesLeft,
        done: p.done,
        won: p.won,
        connected: p.connected,
      };
    });

    const snapshot: Record<string, unknown> = {
      phase: this.state.phase,
      inviteCode: this.state.inviteCode,
      width: this.width,
      height: this.height,
      rowClues: this.rowClues,
      colClues: this.colClues,
      players,
      winnerId: this.winnerId,
      forfeit: this.forfeit,
    };

    if (this.state.phase === "finished") {
      snapshot.colors = this.colors;
    }

    return snapshot;
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}
