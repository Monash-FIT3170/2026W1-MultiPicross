import { Room, Client, ServerError } from "colyseus";
import { PicrossRoomState } from "./schema/PicrossRoomState.js";
import { sql } from "../db/client.js";
import { verifyRoomToken } from "../auth/roomToken.js";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} must be set`);
  return val;
}

interface RoomAuth {
  username: string | null;
}

function generateCode(): string {
  // Unambiguous characters only
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

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
      throw new Error(`No puzzles found for size ${width}x${height}`);
    }

    const puzzle = rows[0];
    this.width = puzzle.width as number;
    this.height = puzzle.height as number;
    this.solution = puzzle.solution as number[];
    this.rowClues = puzzle.row_clues as number[][];
    this.colClues = puzzle.col_clues as number[][];
    this.colors = puzzle.colors as string[];

    const code = generateCode();
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

  async onAuth(
    _client: Client,
    options: { token?: string },
  ): Promise<RoomAuth> {
    if (!options.token) return { username: null };

    const payload = verifyRoomToken(
      options.token,
      requireEnv("JWT_ACCESS_SECRET"),
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
    };
    this.players.set(client.sessionId, player);

    if (this.players.size === 2) {
      this.setPhase("playing");
    }

    client.send("state", this.buildSnapshot());
    this.broadcast("state", this.buildSnapshot(), { except: client });
  }

  onLeave(client: Client) {
    if (this.state.phase === "playing") {
      this.players.forEach((_, sessionId) => {
        if (sessionId !== client.sessionId) {
          this.winnerId = sessionId;
        }
      });
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
