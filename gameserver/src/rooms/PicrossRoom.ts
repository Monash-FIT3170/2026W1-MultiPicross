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
  /** Null outside team-based modes. */
  team: number | null;
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
      team: null,
    };
    this.players.set(client.sessionId, player);
    this.assignTeams();

    if (this.players.size === this.modeConfig.maxPlayers) {
      this.setPhase("playing");
    }

    this.broadcastState();
  }

  // Team assignment is derived from join order, not locked in until the
  // match starts: the 1st and 2nd players currently in the room are Team 1,
  // the 3rd and 4th are Team 2. Recomputing for everyone on every join (using
  // Map's insertion-order iteration) means a pre-match leave-and-replace
  // naturally slots the newcomer into the vacated team instead of always
  // joining Team 2, since indices shift for everyone once a player is gone.
  private assignTeams() {
    if (!this.modeConfig.teamBased) return;
    let index = 0;
    for (const player of this.players.values()) {
      player.team = Math.floor(index / 2);
      index++;
    }
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
      this.broadcastState();
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
    this.broadcastState();
  }

  onLeave(client: Client) {
    if (this.state.phase === "playing") {
      this.players.delete(client.sessionId);
      this.forfeit = true;
      this.checkSoleSurvivor();
      this.checkTeamWipeout();
      // Neither check above always ends the match — with 2+ active players
      // (FFA) or an active member on both teams (2v2) remaining, it simply
      // continues. If nobody left standing can still win (everyone
      // remaining is already eliminated), the match still has to end, just
      // with no winner.
      if (this.state.phase === "playing" && this.allPlayersDone()) {
        this.setPhase("finished");
      }
      this.broadcastState();
      return;
    }
    // Pre-match: team assignment is derived fresh from current join order,
    // so a departure here must be reflected immediately rather than waiting
    // for the next join to recompute it.
    this.players.delete(client.sessionId);
    this.assignTeams();
    this.broadcastState();
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
  // immediately — the team just won, so nothing else to play for. 1v1 also
  // ends immediately: it's always been "first (and only other) player to
  // finish wins," and with exactly 2 players that's indistinguishable from
  // "the other player has nothing left to race for." 3+ player FFA modes
  // (1v1v1, 1v1v1v1) are the only ones that keep racing: the first finisher
  // takes 1st place, but the match only ends once every player has won or
  // been eliminated.
  private handlePlayerWin(sessionId: string, player: PlayerData) {
    player.done = true;
    player.won = true;
    if (!this.winnerId) this.winnerId = sessionId;

    if (this.modeConfig.teamBased || this.modeConfig.maxPlayers === 2) {
      this.setPhase("finished");
      return;
    }

    this.finishOrder.push(sessionId);
    if (this.allPlayersDone()) this.setPhase("finished");
  }

  // Called once a player runs out of lives. In FFA, running out of lives
  // never ends the match by itself while other players remain active — a
  // survivor keeps playing normally; they don't win just because everyone
  // else is out of lives (see checkSoleSurvivor, leave-only). In team-based
  // modes, a full team wipeout DOES auto-win the match for the other team
  // even via elimination alone (see checkTeamWipeout) — a fully eliminated
  // team has nothing left to play for, unlike an eliminated FFA individual
  // whose teammates-of-one-person framing doesn't apply.
  private handlePlayerElimination(player: PlayerData) {
    player.done = true;
    this.checkTeamWipeout();
    // Team modes always have a winnerId by the time anyone could be
    // eliminated (either from an earlier completion, or checkTeamWipeout
    // just above) and the match is already finished in that case — so this
    // only ever fires the FFA "everyone's done" ending, whether or not
    // someone has already won.
    if (this.state.phase === "playing" && this.allPlayersDone()) {
      this.setPhase("finished");
    }
  }

  // Called after a player leaves. If the leave drops the field to exactly
  // one active (non-eliminated) player, there is no one left to race
  // against — the match ends for them right away rather than making them
  // finish alone. This is a leave-only shortcut: a player simply running out
  // of lives does not trigger it (see handlePlayerElimination) — the last
  // remaining player must actually finish unless someone leaves. Not used in
  // team-based modes (see checkTeamWipeout instead).
  //
  // An FFA match can already have a winnerId here (the 1st-place finisher)
  // while still "playing", since remaining players keep racing for
  // placement — that recorded 1st place is never overwritten, but the sole
  // survivor still has nothing left to race against, so the match ends for
  // them too.
  private checkSoleSurvivor() {
    if (this.modeConfig.teamBased) return;

    const survivors = [...this.players.entries()].filter(
      ([, p]) => !p.done,
    );
    if (survivors.length !== 1) return;

    const [winnerId, winner] = survivors[0];
    if (!this.winnerId) this.winnerId = winnerId;
    winner.won = true;
    this.setPhase("finished");
  }

  // Team-based equivalent of checkSoleSurvivor. Unlike FFA, a full team
  // wipeout auto-wins the match for the other team even when it happens
  // purely through elimination (no leave involved) — a fully eliminated
  // team is a clearer terminal state than "last FFA player standing" is for
  // N individuals, so this is checked from both onLeave and
  // handlePlayerElimination.
  private checkTeamWipeout() {
    if (this.winnerId || !this.modeConfig.teamBased) return;

    const activeTeams = new Set(
      [...this.players.values()].filter((p) => !p.done).map((p) => p.team),
    );
    if (activeTeams.size !== 1) return;

    const [survivingTeam] = activeTeams;
    const survivor = [...this.players.entries()].find(
      ([, p]) => !p.done && p.team === survivingTeam,
    );
    if (!survivor) return;

    const [winnerId, winner] = survivor;
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

    this.broadcastState();
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

    this.broadcastState();
  }

  /** Fraction of the puzzle's filled cells this player has correctly filled. */
  private progressFor(p: PlayerData): number {
    const totalFilled = this.solution.reduce((sum, v) => sum + v, 0);
    if (totalFilled === 0) return 0;
    const filled = p.confirmedFilled.reduce(
      (sum, v, i) => sum + (v && this.solution[i] === 1 ? 1 : 0),
      0,
    );
    return filled / totalFilled;
  }

  // Every client receives their own player's full board (cells, crosses,
  // mistakes) exactly as before, but every OTHER player is reduced to
  // aggregated progress data. Nobody's real board layout — solved or
  // unsolved — reaches a client it doesn't belong to, including once the
  // match is "finished": there is no reveal-everyone's-board moment.
  private buildSnapshotFor(viewerSessionId: string) {
    const players: Record<string, unknown> = {};

    this.players.forEach((p, id) => {
      const isViewer = id === viewerSessionId;
      players[id] = {
        username: p.username,
        livesLeft: p.livesLeft,
        done: p.done,
        won: p.won,
        connected: p.connected,
        team: p.team,
        progress: this.progressFor(p),
        ...(isViewer
          ? {
              confirmedFilled: [...p.confirmedFilled],
              crosses: [...p.crosses],
              revealedEmpty: [...p.revealedEmpty],
              mistakeCross: [...p.mistakeCross],
            }
          : {}),
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

  /** Sends every connected client the "state" message scoped to their view. */
  private broadcastState() {
    this.clients.forEach((c) => {
      c.send("state", this.buildSnapshotFor(c.sessionId));
    });
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}
