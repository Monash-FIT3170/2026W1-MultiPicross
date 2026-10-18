import { Room, Client, ServerError, matchMaker } from "colyseus";
import { PicrossRoomState } from "./schema/PicrossRoomState.js";
import { sql } from "../db/client.js";
import { verifyRoomToken } from "../auth/roomToken.js";
import { requireEnv } from "../env.js";
import {
  recordRankedResult,
  recordDoubleEliminationResult,
  type RankedResult,
  type DoubleEliminationResult,
} from "../elo/ratedResults.js";

import { recordMpResults, type MpMode } from "../results/recordResults.js";
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

// Teammate Cursor positions arriving closer together than this are dropped.
// Room.tsx sends at most one every 50ms, so this only bites a client that
// ignores that throttle; the cleared (null) cursor is never dropped.
const CURSOR_MIN_INTERVAL_MS = 15;

type CursorPosition = { x: number; y: number };

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

interface Board {
  confirmedFilled: boolean[];
  crosses: boolean[];
  revealedEmpty: boolean[];
  mistakeCross: boolean[];
}

function emptyBoard(cellCount: number): Board {
  return {
    confirmedFilled: Array(cellCount).fill(false),
    crosses: Array(cellCount).fill(false),
    revealedEmpty: Array(cellCount).fill(false),
    mistakeCross: Array(cellCount).fill(false),
  };
}

function boardArrays(board: Board) {
  return {
    confirmedFilled: [...board.confirmedFilled],
    crosses: [...board.crosses],
    revealedEmpty: [...board.revealedEmpty],
    mistakeCross: [...board.mistakeCross],
  };
}

interface PlayerData {
  accountId: string | null;
  username: string;
  /** The player's own board in FFA; null in team modes (see teamBoards). */
  board: Board | null;
  livesLeft: number;
  /** The player's "Auto-cross solved lines" setting, sent when joining. */
  autoCross: boolean;
  done: boolean;
  won: boolean;
  finishedAt: number | null;
  /** False while the player is inside their reconnection window. */
  connected: boolean;
  /** Null outside team-based modes. */
  team: number | null;
  /** When this player's last Teammate Cursor position was forwarded. */
  lastCursorAt: number;
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
  // Recorded once, when the match ends, so the result outlives the winner's
  // seat: players leaving the results screen must not change the outcome.
  /** Team modes only: the Team that won. Null in FFA or with no winner. */
  private winnerTeam: number | null = null;
  private winnerName = "";
  private forfeit = false;
  private isRanked = false;
  private rankedResultRecorded = false;
  // private rankedResult: RankedResult | null = null;

  private rankedResult:
    | (RankedResult & {
        resultType: "normal";
      })
    | (DoubleEliminationResult & {
        resultType: "double-elimination";
        playerOneSessionId: string;
        playerTwoSessionId: string;
      })
    | null = null;
  private puzzleId = "";
  private mpMode: MpMode = "unrated";
  private startedAt = 0;
  private resultsRecorded = false;
  private mode: GameMode = DEFAULT_GAME_MODE;
  private modeConfig: GameModeConfig = GAME_MODES[DEFAULT_GAME_MODE];
  /**
   * Team modes only: one shared Team Board per team, indexed by team. Both
   * teammates' moves land here; lives and elimination stay per-player (see
   * docs/adr/0001-2v2-shared-team-board.md).
   */
  private teamBoards: Board[] = [];

  async onCreate(options: {
    width?: number;
    height?: number;
    isRanked?: boolean;
    isPublic?: boolean;
    mode?: string;
  }) {
    this.isRanked = options.isRanked === true;
    this.mpMode = this.isRanked
      ? "ranked"
      : options.isPublic
        ? "public"
        : "unrated";
    const width = options.width ?? 10;
    const height = options.height ?? 10;

    this.mode = isGameMode(options.mode) ? options.mode : DEFAULT_GAME_MODE;
    this.modeConfig = GAME_MODES[this.mode];
    this.maxClients = this.modeConfig.maxPlayers;

    const rows = await sql`
      SELECT id, width, height, row_clues, col_clues, solution, colors
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
    this.puzzleId = puzzle.id as string;
    this.width = puzzle.width as number;
    this.height = puzzle.height as number;
    this.solution = puzzle.solution as number[];
    this.rowClues = puzzle.row_clues as number[][];
    this.colClues = puzzle.col_clues as number[][];
    this.colors = puzzle.colors as string[];

    if (this.modeConfig.teamBased) {
      this.teamBoards = Array.from({ length: this.modeConfig.teamCount }, () =>
        emptyBoard(this.width * this.height),
      );
    }

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

    this.onMessage<unknown>("cursor", (client, msg) => {
      this.handleCursor(client.sessionId, msg);
    });
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

  onJoin(client: Client, options: { username?: string; autoCross?: boolean }) {
    const cellCount = this.width * this.height;
    const player: PlayerData = {
      accountId: (client.auth as RoomAuth).accountId,
      username: this.resolveUsername(client, options.username),
      board: this.modeConfig.teamBased
        ? null
        : emptyBoard(this.width * this.height),
      livesLeft: 3,
      autoCross: options.autoCross !== false,
      done: false,
      won: false,
      finishedAt: null,
      connected: true,
      team: null,
      lastCursorAt: 0,
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
  // Once the match has started a player's Team never changes again.
  private assignTeams() {
    if (!this.modeConfig.teamBased || this.state.phase !== "waiting") return;
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
      this.clearCursorOf(client.sessionId, player);
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
    // Ranked is always 1v1 and keeps both players seated after the match
    // ends: the results page needs both snapshots, and Elo calculation needs
    // both players' account IDs and statistics.
    if (this.isRanked) {
      this.onRankedLeave(client);
      return;
    }
    if (this.state.phase === "playing") {
      const leaving = this.players.get(client.sessionId);
      if (leaving) this.clearCursorOf(client.sessionId, leaving);
      this.players.delete(client.sessionId);
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
      // Only a departure that ended the match is a forfeit. One the match
      // survived must not relabel a later win on merit as "opponent left".
      if (this.state.phase !== "playing") this.forfeit = true;
      this.broadcastState();
      return;
    }
    // Pre-match: team assignment is derived fresh from current join order,
    // so a departure here must be reflected immediately rather than waiting
    // for the next join to recompute it. A leave from a finished room lands
    // here too, where assignTeams() leaves the Teams as they were.
    this.players.delete(client.sessionId);
    this.assignTeams();
    this.broadcastState();
  }

  private onRankedLeave(client: Client) {
    if (this.state.phase === "playing") {
      // A forfeit win may only go to a player who is still alive. If the last
      // player standing had already burned all three lives their elimination
      // stands and nobody wins — crowning them was reporting a loss as a win.
      // Never overwrite an already-decided winner either.
      if (!this.winnerId) {
        const survivors = [...this.players.entries()].filter(
          ([sessionId, player]) =>
            sessionId !== client.sessionId && !player.done,
        );

        if (survivors.length === 1) {
          this.winnerId = survivors[0][0];
        }
      }

      this.forfeit = true;
      this.setPhase("finished");
    } else if (this.state.phase !== "finished") {
      // A player leaving the waiting lobby is not a match result.
      this.players.delete(client.sessionId);
    }

    this.broadcastState();
  }

  // Centralizes the "started and finished rooms must not be joinable/listed"
  // invariant in one place instead of every phase-transition call site.
  private setPhase(phase: "waiting" | "playing" | "finished") {
    this.state.phase = phase;
    if (phase === "playing") {
      this.startedAt = Date.now();
      // A full room is already auto-locked, but Colyseus lifts that lock the
      // moment a player leaves; an explicit lock holds, so a mid-match
      // departure never reopens the seat to a late joiner.
      this.lock();
    }
    if (phase === "finished") {
      // Every caller sets winnerId first, and the winner is still seated.
      const winner = this.players.get(this.winnerId);
      this.winnerTeam = winner?.team ?? null;
      this.winnerName = winner?.username ?? "";
      // Every 2v2 player has a teammate whose pointer should now disappear.
      if (this.modeConfig.teamBased) this.broadcast("teammateCursor", null);
      this.lock();
      void this.recordRankedResult();
      void this.recordResults();
    }
  }

  /** True once every remaining player has either won or been eliminated. */
  private allPlayersDone(): boolean {
    return [...this.players.values()].every((p) => p.done);
  }

  // Called once a player's board is fully solved. Every mode ends the match
  // right here: the first player (FFA) or team (2v2) to complete the puzzle
  // wins, and nobody keeps racing for a lower place.
  private handlePlayerWin(sessionId: string, player: PlayerData) {
    player.done = true;
    player.won = true;
    player.finishedAt = Date.now();
    this.winnerId = sessionId;
    this.setPhase("finished");
  }

  // Called once a player runs out of lives. In FFA, running out of lives
  // never ends the match by itself while other players remain active — a
  // survivor keeps playing normally; they don't win just because everyone
  // else is out of lives (see checkSoleSurvivor, leave-only). In team-based
  // modes, a full team wipeout DOES auto-win the match for the other team
  // even via elimination alone (see checkTeamWipeout) — a fully eliminated
  // team has nothing left to play for, unlike an eliminated FFA individual
  // whose teammates-of-one-person framing doesn't apply.
  //
  // 1v1 is the exception: with only one opponent there is no race left to
  // run, so the match ends on the spot and the opponent still alive wins.
  private handlePlayerElimination(sessionId: string, player: PlayerData) {
    player.done = true;
    player.finishedAt = Date.now();
    if (this.mode === "1v1") {
      this.finishByElimination();
      return;
    }
    // An eliminated 2v2 player spectates; their pointer no longer means
    // anything to the teammate still solving.
    this.clearCursorOf(sessionId, player);
    this.checkTeamWipeout();
    // A team mode that reaches all-players-done was just ended by
    // checkTeamWipeout above — so this only ever fires the FFA "everyone's
    // out of lives" ending, which has no winner.
    if (this.state.phase === "playing" && this.allPlayersDone()) {
      this.setPhase("finished");
    }
  }

  private finishByElimination() {
    const survivors = [...this.players.entries()].filter(([, p]) => !p.done);

    if (survivors.length === 1) {
      this.winnerId = survivors[0][0];
    }

    this.setPhase("finished");
  }

  // Called after a player leaves. If the leave drops the field to exactly
  // one active (non-eliminated) player, there is no one left to race
  // against — the match ends for them right away rather than making them
  // finish alone. This is a leave-only shortcut: a player simply running out
  // of lives does not trigger it (see handlePlayerElimination) — the last
  // remaining player must actually finish unless someone leaves. Not used in
  // team-based modes (see checkTeamWipeout instead).
  private checkSoleSurvivor() {
    if (this.modeConfig.teamBased) return;

    const survivors = [...this.players.entries()].filter(([, p]) => !p.done);
    if (survivors.length !== 1) return;

    const [winnerId, winner] = survivors[0];
    this.winnerId = winnerId;
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
    if (!this.isRanked || this.rankedResultRecorded) {
      return;
    }

    const players = [...this.players.entries()];

    if (players.length !== 2) {
      return;
    }

    const [firstSessionId, firstPlayer] = players[0];
    const [secondSessionId, secondPlayer] = players[1];

    // Both players were eliminated: both lose Elo.
    if (!this.winnerId && firstPlayer.done && secondPlayer.done) {
      if (!firstPlayer.accountId || !secondPlayer.accountId) {
        return;
      }

      this.rankedResultRecorded = true;

      try {
        const result = await recordDoubleEliminationResult({
          playerOneAccountId: firstPlayer.accountId,
          playerTwoAccountId: secondPlayer.accountId,
          playerOneMistakes: 3 - firstPlayer.livesLeft,
          playerTwoMistakes: 3 - secondPlayer.livesLeft,
        });

        this.rankedResult = {
          ...result,
          resultType: "double-elimination",
          playerOneSessionId: firstSessionId,
          playerTwoSessionId: secondSessionId,
        };

        // Send a new snapshot after both Elo updates have completed.
        this.broadcastState();

        console.log("Double-elimination Elo recorded.");
      } catch (error) {
        this.rankedResultRecorded = false;
        console.error("Double-elimination Elo error", error);
      }

      return;
    }

    // Normal ranked result: one player won.
    if (!this.winnerId) {
      return;
    }

    const winner = this.players.get(this.winnerId);

    const loser =
      this.winnerId === firstSessionId
        ? secondPlayer
        : this.winnerId === secondSessionId
          ? firstPlayer
          : undefined;

    if (!winner?.accountId || !loser?.accountId) {
      return;
    }

    this.rankedResultRecorded = true;

    try {
      const result = await recordRankedResult({
        winnerAccountId: winner.accountId,
        loserAccountId: loser.accountId,
        winnerMistakes: 3 - winner.livesLeft,
        loserMistakes: 3 - loser.livesLeft,
        boardSize: this.width,
      });

      this.rankedResult = {
        ...result,
        resultType: "normal",
      };

      this.broadcastState();
    } catch (error) {
      this.rankedResultRecorded = false;
      console.error("ranked result error", error);
    }
  }

  // Rows are built synchronously: onLeave() deletes the leaver right after
  // setPhase("finished"), so the player map must be read before any await.
  private async recordResults(): Promise<void> {
    if (this.resultsRecorded || !this.startedAt) return;
    this.resultsRecorded = true;

    const now = Date.now();
    const rows = [...this.players.entries()].flatMap(([sessionId, p]) =>
      p.accountId
        ? [
            {
              accountId: p.accountId,
              puzzleId: this.puzzleId,
              mode: this.mpMode,
              solved: p.won,
              won: sessionId === this.winnerId,
              elapsedSeconds: Math.round(
                ((p.finishedAt ?? now) - this.startedAt) / 1000,
              ),
              livesLeft: p.livesLeft,
            },
          ]
        : [],
    );

    try {
      await recordMpResults(rows);
    } catch (error) {
      console.error("mp result error", error);
    }
  }

  /** The board a player's moves land on: their Team Board, or their own. */
  private boardFor(player: PlayerData): Board {
    if (player.board) return player.board;
    return this.teamBoards[player.team ?? 0];
  }

  /** Session ids of the player and, in team modes, their teammate. */
  private teamOf(sessionId: string, player: PlayerData): string[] {
    if (!this.modeConfig.teamBased) return [sessionId];
    return [...this.players.entries()]
      .filter(([, p]) => p.team === player.team)
      .map(([id]) => id);
  }

  /** Sends a message to the player's teammate(s), never to anyone else. */
  private sendToTeammates(
    sessionId: string,
    player: PlayerData,
    type: string,
    msg: unknown,
  ) {
    const teammates = new Set(this.teamOf(sessionId, player));
    teammates.delete(sessionId);
    for (const c of this.clients) {
      if (teammates.has(c.sessionId)) c.send(type, msg);
    }
  }

  // Teammate Cursor: a 2v2 player's live pointer position, in board
  // coordinates (fractional column/row over the cell area, so it maps onto
  // any window or cell size). Relayed to the teammate only — never to the
  // opposing team — and never stored or put in the snapshot.
  private handleCursor(sessionId: string, msg: unknown) {
    if (!this.modeConfig.teamBased || this.state.phase !== "playing") return;
    const player = this.players.get(sessionId);
    if (!player || player.done) return;

    if (msg === null) {
      this.sendToTeammates(sessionId, player, "teammateCursor", null);
      return;
    }
    const position = this.parseCursor(msg);
    if (!position) return;

    const now = Date.now();
    if (now - player.lastCursorAt < CURSOR_MIN_INTERVAL_MS) return;
    player.lastCursorAt = now;
    this.sendToTeammates(sessionId, player, "teammateCursor", position);
  }

  private parseCursor(msg: unknown): CursorPosition | null {
    if (typeof msg !== "object" || msg === null) return null;
    const { x, y } = msg as Record<string, unknown>;
    if (typeof x !== "number" || typeof y !== "number") return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < 0 || x > this.width || y < 0 || y > this.height) return null;
    return { x, y };
  }

  /** Tells the teammate this player's pointer is gone (left/dropped/out). */
  private clearCursorOf(sessionId: string, player: PlayerData) {
    if (!this.modeConfig.teamBased) return;
    this.sendToTeammates(sessionId, player, "teammateCursor", null);
  }

  private isSolved(board: Board): boolean {
    return this.solution.every((v, i) => v === 0 || board.confirmedFilled[i]);
  }

  private autoCross(board: Board) {
    board.crosses = applyAutoComplete(
      board.confirmedFilled,
      board.crosses,
      this.rowClues,
      this.colClues,
      this.width,
      this.height,
    );
  }

  // Lives and the done check are per-player even on a shared Team Board: a
  // done (eliminated) player can no longer move, but their teammate can, and
  // a mistake costs only whoever made it. Moves are applied one at a time, so
  // two teammates acting on the same cell simply resolve in arrival order —
  // the second finds the cell already confirmed/revealed and is a no-op.
  private handleFill(sessionId: string, row: number, col: number) {
    if (this.state.phase !== "playing") return;
    const player = this.players.get(sessionId);
    if (!player || player.done) return;
    if (row < 0 || row >= this.height || col < 0 || col >= this.width) return;

    const board = this.boardFor(player);
    const idx = row * this.width + col;
    if (board.confirmedFilled[idx] || board.revealedEmpty[idx]) return;

    if (this.solution[idx] === 1) {
      board.confirmedFilled[idx] = true;
      board.crosses[idx] = true; // (or whatever your branch uses)

      // Keep your feature's auto-cross setting check:
      if (player.autoCross) {
        board.crosses = applyAutoComplete(
          board.confirmedFilled,
          board.crosses,
          this.rowClues,
          this.colClues,
          this.width,
          this.height,
        );
      } else {
        this.autoCross(board); // Or keep main's helper if autoCross is handled there
      }

      // Use main's clean win-handling method:
      if (this.isSolved(board)) {
        this.handlePlayerWin(sessionId, player);
      }
    } else {
      board.revealedEmpty[idx] = true;
      player.livesLeft = Math.max(0, player.livesLeft - 1);
      if (player.livesLeft === 0) {
        this.handlePlayerElimination(sessionId, player);
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

    const board = this.boardFor(player);
    const idx = row * this.width + col;
    if (board.confirmedFilled[idx] || board.revealedEmpty[idx]) return;

    if (markCross && this.solution[idx] === 1) {
      // Mistaken cross on a filled cell — reveal it and lose a life
      board.confirmedFilled[idx] = true;
      board.crosses[idx] = false;
      board.mistakeCross[idx] = true;
      player.livesLeft = Math.max(0, player.livesLeft - 1);
<<<<<<< HEAD
      if (player.autoCross) {
        player.crosses = applyAutoComplete(
          player.confirmedFilled,
          player.crosses,
          this.rowClues,
          this.colClues,
          this.width,
          this.height,
        );
      }
=======
      this.autoCross(board);
>>>>>>> 2418fb9bacec214ac946c6b5aedbda488780381c

      // Solved is checked first: a mistake that reveals the final cell wins,
      // even when it also costs the player their last life.
      if (this.isSolved(board)) {
        this.handlePlayerWin(sessionId, player);
      } else if (player.livesLeft === 0) {
        this.handlePlayerElimination(sessionId, player);
      }

      // Must precede the broadcast: the client needs the index before the grid
      // changes, or the board plays the success pop instead of the shake.
      // On a Team Board both teammates are looking at the cell that changed.
      const recipients = new Set(this.teamOf(sessionId, player));
      for (const c of this.clients) {
        if (recipients.has(c.sessionId)) c.send("mistake", { idx });
      }
    } else {
      board.crosses[idx] = markCross;
    }

    this.broadcastState();
  }

  /** Fraction of the puzzle's filled cells correctly filled on a board. */
  private progressFor(board: Board): number {
    const totalFilled = this.solution.reduce((sum, v) => sum + v, 0);
    if (totalFilled === 0) return 0;
    const filled = board.confirmedFilled.reduce(
      (sum, v, i) => sum + (v && this.solution[i] === 1 ? 1 : 0),
      0,
    );
    return filled / totalFilled;
  }

  // Every client receives every board (cells, crosses, mistakes), plus
  // aggregated progress data. The client is responsible for blurring other
  // players' boards during play (see Room.tsx). In team modes the boards are
  // per team (`teamBoards`) and player entries carry no board data.
  private buildSnapshot() {
    const players: Record<string, unknown> = {};

    this.players.forEach((p, id) => {
      players[id] = {
        username: p.username,
        livesLeft: p.livesLeft,
        done: p.done,
        won: p.won,
        connected: p.connected,
        team: p.team,
        ...(p.board && {
          progress: this.progressFor(p.board),
          ...boardArrays(p.board),
        }),
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
      winnerTeam: this.winnerTeam,
      winnerName: this.winnerName,
      forfeit: this.forfeit,
      mode: this.mode,
      rankedResult: this.isRanked ? this.rankedResult : undefined,
    };

    if (this.modeConfig.teamBased) {
      snapshot.teamBoards = Object.fromEntries(
        this.teamBoards.map((board, team) => [
          team,
          { ...boardArrays(board), progress: this.progressFor(board) },
        ]),
      );
    }

    if (this.state.phase === "finished") {
      snapshot.colors = this.colors;
      snapshot.solution = [...this.solution];
    }

    return snapshot;
  }

  /** Sends every connected client the same "state" message. */
  private broadcastState() {
    this.broadcast("state", this.buildSnapshot());
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}
