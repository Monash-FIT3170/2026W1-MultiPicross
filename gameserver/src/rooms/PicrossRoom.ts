import { Room, Client, ServerError, matchMaker } from "colyseus";
import { PicrossRoomState } from "./schema/PicrossRoomState.js";
import { sql } from "../db/client.js";
import { verifyRoomToken } from "../auth/roomToken.js";
import { requireEnv } from "../env.js";
import { recordRankedResult } from "../elo/ratedResults.js";
import {
  DEFAULT_GAME_MODE,
  GAME_MODES,
  isGameMode,
  type GameMode,
  type GameModeConfig,
} from "./gameModes.js";

interface RoomAuth {
  username: string | null;
  accountId: string | null;
}

// Invite-code alphabet: unambiguous characters only (no O/0, no I/1).
// app.config.ts builds its validation pattern from this.
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 6;

// Thrown by onCreate() when the puzzle bank holds nothing of the requested
// size. Survives matchMaker's rethrow, so /create-room can answer 404 rather
// than 500. Clear of Colyseus's own ErrorCode and CloseCode ranges.
export const ERR_NO_PUZZLE_FOR_SIZE = 4500;

/** Bounded re-rolls when a freshly generated invite code is already in use. */
const INVITE_CODE_ATTEMPTS = 10;

// How long a seat is held open after an unconsented disconnect before the
// match is forfeited. Room.tsx caps its retries to match this window.
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

// After a correct fill, cross out every remaining empty cell in any row or
// column whose clue total is now satisfied. 0-clue lines satisfy immediately.
//
// Duplicated on purpose: Singleplayer.tsx runs the same algorithm over a
// CellValue[] grid. Separate Docker build contexts mean neither side can
// import the other, so a change here needs the matching change there.
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
  accountId: string | null;
  username: string;
  confirmedFilled: boolean[];
  crosses: boolean[];
  revealedEmpty: boolean[];
  mistakeCross: boolean[];
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
  private isRanked = false;
  private rankedResultRecorded = false;
  private mode: GameMode = DEFAULT_GAME_MODE;
  private modeConfig: GameModeConfig = GAME_MODES[DEFAULT_GAME_MODE];
  /** FFA only: sessionIds in completion order. Team modes have no placement. */
  private finishOrder: string[] = [];

  async onCreate(options: {
    width?: number;
    height?: number;
    isRanked?: boolean;
    isPublic?: boolean;
    mode?: string;
  }) {
    this.isRanked = options.isRanked === true;
    const width = options.width ?? 10;
    const height = options.height ?? 10;

    this.mode = isGameMode(options.mode) ? options.mode : DEFAULT_GAME_MODE;
    this.modeConfig = GAME_MODES[this.mode];
    this.maxClients = this.modeConfig.maxPlayers;

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
      mode: this.mode,
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
        this.handleCross(client, msg.row, msg.col, msg.markCross);
      },
    );
  }

  // Invite codes are the lookup key for /room-by-code, so a duplicate would
  // route joiners to whichever room the matchmaker finds first. Our own
  // listing is not persisted until onCreate() returns, so this cannot match
  // ourselves.
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
    if (!options.token) return { username: null, accountId: null };

    const payload = verifyRoomToken(
      options.token,
      requireEnv("JWT_ROOM_SECRET"),
    );
    if (!payload) {
      throw new ServerError(401, "Invalid or expired room token");
    }
    return { username: payload.username, accountId: payload.sub };
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
      accountId: (client.auth as RoomAuth).accountId,
      username: this.resolveUsername(client, options.username),
      confirmedFilled: Array(cellCount).fill(false),
      crosses: Array(cellCount).fill(false),
      revealedEmpty: Array(cellCount).fill(false),
      mistakeCross: Array(cellCount).fill(false),
      livesLeft: 3,
      done: false,
      won: false,
      connected: true,
    };
    this.players.set(client.sessionId, player);

    if (this.players.size === this.modeConfig.maxPlayers) {
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
      this.players.delete(client.sessionId);
      this.forfeit = true;
      this.checkSoleSurvivor();
      // checkSoleSurvivor only ends the match when it finds a winner. With
      // no players left able to win (everyone remaining already
      // eliminated) the match still has to end — just with no winner.
      if (this.state.phase === "playing" && this.allPlayersDone()) {
        this.setPhase("finished");
      }
      this.broadcast("state", this.buildSnapshot());
      return;
    }
    this.players.delete(client.sessionId);
    this.broadcast("state", this.buildSnapshot());
  }

  // Centralizes the "finished rooms must not be joinable/listed" invariant
  // in one place instead of every phase-transition call site.
  private setPhase(phase: "waiting" | "playing" | "finished") {
    this.state.phase = phase;
    if (phase === "finished") {
      this.lock();
      void this.recordRankedResult();
    }
  }

  /** True once every remaining player has either won or been eliminated. */
  private allPlayersDone(): boolean {
    return [...this.players.values()].every((p) => p.done);
  }

  // Called once a player's board is fully solved. Team modes end the match
  // immediately, same as 1v1 always has — the team just won, so nothing else
  // to play for. FFA modes keep racing: the first finisher takes 1st place,
  // but the match only ends once every player has won or been eliminated.
  private handlePlayerWin(sessionId: string, player: PlayerData) {
    player.done = true;
    player.won = true;
    if (!this.winnerId) this.winnerId = sessionId;

    if (this.modeConfig.teamBased) {
      this.setPhase("finished");
      return;
    }

    this.finishOrder.push(sessionId);
    if (this.allPlayersDone()) this.setPhase("finished");
  }

  // Called once a player runs out of lives. Running out of lives never ends
  // the match by itself while other players remain connected and active —
  // only every remaining player being done (won or eliminated) does. A
  // survivor keeps playing normally; they don't win just because everyone
  // else is out of lives (they still have to finish, or be the one left
  // after someone actually leaves — see checkSoleSurvivor).
  private handlePlayerElimination(player: PlayerData) {
    player.done = true;
    if (this.allPlayersDone()) this.setPhase("finished");
  }

  // Called after a player leaves while no winner has been decided yet. If
  // the leave drops the field to exactly one active (non-eliminated) player,
  // there is no one left to race against — declare them the winner
  // immediately rather than making them finish alone. This is a leave-only
  // shortcut: a player simply running out of lives does not trigger it (see
  // handlePlayerElimination) — the last remaining player must actually
  // finish unless someone leaves.
  private checkSoleSurvivor() {
    if (this.winnerId) return;

    const survivors = [...this.players.entries()].filter(
      ([, p]) => !p.done,
    );
    if (survivors.length !== 1) return;

    const [winnerId, winner] = survivors[0];
    this.winnerId = winnerId;
    winner.won = true;
    this.setPhase("finished");
  }

  private async recordRankedResult(): Promise<void> {
    if (!this.isRanked || this.rankedResultRecorded || !this.winnerId) return;

    const winner = this.players.get(this.winnerId);
    const loser = [...this.players.entries()].find(
      ([sessionId]) => sessionId !== this.winnerId,
    )?.[1];

    if (!winner?.accountId || !loser?.accountId) return;

    this.rankedResultRecorded = true;
    try {
      await recordRankedResult({
        winnerAccountId: winner.accountId,
        loserAccountId: loser.accountId,
        winnerMistakes: 3 - winner.livesLeft,
        loserMistakes: 3 - loser.livesLeft,
      });
    } catch (error) {
      this.rankedResultRecorded = false;
      console.error("ranked result error", error);
    }
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
        this.handlePlayerWin(sessionId, player);
      }
    } else {
      player.revealedEmpty[idx] = true;
      player.livesLeft = Math.max(0, player.livesLeft - 1);
      if (player.livesLeft === 0) {
        this.handlePlayerElimination(player);
      }
    }

    this.broadcast("state", this.buildSnapshot());
  }

  private handleCross(
    client: Client,
    row: number,
    col: number,
    markCross: boolean,
  ) {
    if (this.state.phase !== "playing") return;
    const sessionId = client.sessionId;
    const player = this.players.get(sessionId);
    if (!player || player.done) return;
    if (row < 0 || row >= this.height || col < 0 || col >= this.width) return;

    const idx = row * this.width + col;
    if (player.confirmedFilled[idx] || player.revealedEmpty[idx]) return;

    if (markCross && this.solution[idx] === 1) {
      // Mistaken cross on a filled cell — reveal it and lose a life
      player.confirmedFilled[idx] = true;
      player.crosses[idx] = false;
      player.mistakeCross[idx] = true;
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
        this.handlePlayerWin(sessionId, player);
      } else if (player.livesLeft === 0) {
        this.handlePlayerElimination(player);
      }

      // Must precede the broadcast: the client needs the index before the grid
      // changes, or the board plays the success pop instead of the shake.
      client.send("mistake", { idx });
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
        mistakeCross: boolean[];
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
        mistakeCross: [...p.mistakeCross],
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
      mode: this.mode,
      finishOrder: [...this.finishOrder],
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
