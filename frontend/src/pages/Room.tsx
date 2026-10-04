import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Room as ColyseusRoom } from "@colyseus/sdk";
import { gameserverClient } from "../colyseus";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import NonogramGrid, {
  type CellValue,
  autoCellSize,
  cellsToGrid,
  fmtSeconds,
} from "../components/NonogramGrid";
import {
  Logo,
  Icon,
  Button,
  LivesPips,
  StatTile,
  ConfirmDialog,
} from "../components/ui";
import {
  type BoardGeometry,
  type CursorPosition,
  TeammateCursorOverlay,
  createCursorStream,
  useTeammateCursorSender,
} from "../components/TeammateCursor";

// ── Types ────────────────────────────────────────────────────────────────────

interface BoardSnapshot {
  confirmedFilled: boolean[];
  crosses: boolean[];
  revealedEmpty: boolean[];
  mistakeCross: boolean[];
  /** Fraction (0-1) of the puzzle's filled cells correctly filled on this board. */
  progress: number;
}

// In FFA each player carries their own board; in 2v2 the board lives on the
// team (RoomSnapshot.teamBoards) and player entries carry none of it.
interface PlayerSnapshot extends Partial<BoardSnapshot> {
  username: string;
  livesLeft: number;
  done: boolean;
  won: boolean;
  /** False while the player is inside their server-side reconnection window. */
  connected: boolean;
  team: number | null;
}

interface RoomSnapshot {
  phase: "waiting" | "playing" | "finished";
  inviteCode: string;
  width: number;
  height: number;
  rowClues: number[][];
  colClues: number[][];
  players: Record<string, PlayerSnapshot>;
  winnerId: string;
  forfeit: boolean;
  colors?: string[];
  mode: string;
  /** 2v2 only: the shared Team Board of each team, keyed by team index. */
  teamBoards?: Record<string, BoardSnapshot>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_BOARD: BoardSnapshot = {
  confirmedFilled: [],
  crosses: [],
  revealedEmpty: [],
  mistakeCross: [],
  progress: 0,
};

/** The board a player plays on: their Team Board in 2v2, their own in FFA. */
function boardOf(snapshot: RoomSnapshot, p: PlayerSnapshot): BoardSnapshot {
  if (snapshot.teamBoards) {
    return snapshot.teamBoards[String(p.team ?? 0)] ?? EMPTY_BOARD;
  }
  return {
    confirmedFilled: p.confirmedFilled ?? [],
    crosses: p.crosses ?? [],
    revealedEmpty: p.revealedEmpty ?? [],
    mistakeCross: p.mistakeCross ?? [],
    progress: p.progress ?? 0,
  };
}

function buildGrid(b: BoardSnapshot): CellValue[] {
  return cellsToGrid(b.confirmedFilled, b.crosses, b.revealedEmpty);
}

function mistakeCrossIndicesOf(b: BoardSnapshot): number[] {
  return b.mistakeCross.reduce<number[]>((acc, v, i) => {
    if (v) acc.push(i);
    return acc;
  }, []);
}

const OWN_TEAM_ACCENT = "var(--color-sage-400)";
const OTHER_TEAM_ACCENT = "var(--color-coral-400)";

const MODE_MAX_PLAYERS: Record<string, number> = {
  "1v1": 2,
  "1v1v1": 3,
  "1v1v1v1": 4,
  "2v2": 4,
};

/** Falls back to 2 (1v1) for an unrecognized mode string. */
function maxPlayersFor(mode: string): number {
  return MODE_MAX_PLAYERS[mode] ?? 2;
}

// leave() throws while a socket is mid-handshake — an SDK reconnect in
// flight when the user navigates away. The connection is going either way.
function leaveQuietly(room: ColyseusRoom | null) {
  try {
    room?.leave();
  } catch {
    /* already gone */
  }
}

// ── Main component ───────────────────────────────────────────────────────────

export function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { status, playerName } = useAuth();
  const isRanked = searchParams.get("mode") === "ranked";

  const roomRef = useRef<ColyseusRoom | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [copied, setCopied] = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const playingStartRef = useRef<number | null>(null);
  const [confirmingAbandon, setConfirmingAbandon] = useState(false);
  const intentionalLeaveRef = useRef(false);
  const [mistakeCrossIdx, setMistakeCrossIdx] = useState<number | null>(null);
  const mistakeCrossTimerRef = useRef<number | undefined>(undefined);
  // 2v2 Teammate Cursor: fed straight from the socket, never via React state
  // (see TeammateCursor.tsx), and the board element the local pointer is
  // measured against.
  const [cursorStream] = useState(createCursorStream);
  const boardWrapRef = useRef<HTMLDivElement>(null);

  // ── Auth, captured once ────────────────────────────────────────────────────

  // Auth decides how we join, but only at connect time. apiFetch() calls
  // onLogout() when a refresh fails, flipping `status`; with `status` as a
  // dependency of the connect effect that tore down the live socket, which
  // the server reads as a quit. So the connect effect reads auth through this
  // ref and depends only on `authReady`.
  const authRef = useRef({ status, playerName });

  useEffect(() => {
    authRef.current = { status, playerName };
  }, [status, playerName]);

  // A one-way latch: flips false→true once when the auth bootstrap resolves,
  // giving the connect effect a dependency that does not re-fire on later
  // authenticated↔unauthenticated transitions.
  const authReady = status !== "loading";

  // ── Connect to room ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId || !authReady) return;

    let cancelled = false;

    async function connect() {
      try {
        const { status: authStatus, playerName: name } = authRef.current;
        let joinOptions: { token: string } | { username: string };

        if (authStatus === "authenticated") {
          const res = await apiFetch("/auth/room-token", { method: "POST" });
          if (!res.ok) throw new Error("Could not authenticate for room.");
          const { token } = (await res.json()) as { token: string };
          joinOptions = { token };
        } else {
          joinOptions = { username: name ?? "Guest" };
        }

        const room = await gameserverClient.joinById(roomId!, joinOptions);

        if (cancelled) {
          leaveQuietly(room);
          return;
        }

        // The server holds a dropped seat ~20s (RECONNECTION_WINDOW_SECONDS); 8
        // attempts of the SDK's backoff span about that, rather than spinning for
        // the default 15 long after the match is forfeited.
        room.reconnection.maxRetries = 8;

        roomRef.current = room;
        setMySessionId(room.sessionId);

        room.onMessage<RoomSnapshot>("state", (msg) => {
          setSnapshot(msg);
        });

        // Sent to the player who made the mistake — and in 2v2 to their
        // teammate too, since the shared Team Board changed under both.
        room.onMessage<{ idx: number }>("mistake", (msg) => {
          if (cancelled) return;
          setMistakeCrossIdx(msg.idx);
          window.clearTimeout(mistakeCrossTimerRef.current);
          mistakeCrossTimerRef.current = window.setTimeout(() => {
            setMistakeCrossIdx(null);
          }, 450);
        });

        // 2v2 only, and only ever from the teammate.
        room.onMessage<CursorPosition | null>("teammateCursor", (msg) => {
          if (!cancelled) cursorStream.push(msg);
        });

        // A drop is not a leave: the SDK re-establishes the session while the server
        // holds the seat, so show it as transient.
        room.onDrop(() => {
          if (cancelled) return;
          setReconnecting(true);
          // Positions from before the drop are stale by the time we're back.
          cursorStream.push(null);
        });

        room.onReconnect(() => {
          if (!cancelled) setReconnecting(false);
        });

        // Only fires for a consented leave or after reconnection genuinely
        // failed, so by this point the seat really is gone.
        room.onLeave(() => {
          if (cancelled || intentionalLeaveRef.current) return;
          setReconnecting(false);
          setError("Lost connection to the room.");
        });

        room.onError((code, message) => {
          if (!cancelled)
            setError(`Room error (${code}): ${message ?? "unknown"}`);
        });
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : "Could not join room.";
          setError(msg);
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
      leaveQuietly(roomRef.current);
      roomRef.current = null;
      // A pending index would shake a cell on whatever board renders next.
      window.clearTimeout(mistakeCrossTimerRef.current);
      setMistakeCrossIdx(null);
      cursorStream.push(null);
    };
  }, [roomId, authReady, retryNonce, cursorStream]);

  // ── Timer ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (snapshot?.phase !== "playing") {
      playingStartRef.current = null;
      return;
    }
    if (playingStartRef.current === null) {
      playingStartRef.current = Date.now();
    }
    const start = playingStartRef.current;
    setDisplaySeconds(Math.floor((Date.now() - start) / 1000));
    const id = setInterval(
      () => setDisplaySeconds(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [snapshot?.phase]);

  // ── Teammate Cursor (2v2) ──────────────────────────────────────────────────

  // Mirrors NonogramGrid's own layout maths (clue gutters are at least one
  // cell even when every clue is a single number).
  const cursorGeometry: BoardGeometry = {
    width: snapshot?.width ?? 0,
    height: snapshot?.height ?? 0,
    rowClueCols: Math.max(
      1,
      ...(snapshot?.rowClues ?? []).map((r) => r.length),
    ),
    colClueRows: Math.max(
      1,
      ...(snapshot?.colClues ?? []).map((c) => c.length),
    ),
    cellSize: autoCellSize(snapshot?.width ?? 0, snapshot?.height ?? 0),
  };
  const meNow =
    snapshot && mySessionId ? snapshot.players[mySessionId] : undefined;
  useTeammateCursorSender(
    boardWrapRef,
    cursorGeometry,
    snapshot?.phase === "playing" &&
      snapshot.mode === "2v2" &&
      meNow !== undefined &&
      !meNow.done &&
      !reconnecting,
    (position) => roomRef.current?.send("cursor", position),
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  function handleFill(row: number, col: number) {
    roomRef.current?.send("fill", { row, col });
  }

  function handleCross(row: number, col: number, markCross: boolean) {
    roomRef.current?.send("cross", { row, col, markCross });
  }

  function retryConnection() {
    setError(null);
    setReconnecting(false);
    setSnapshot(null);
    setMistakeCrossIdx(null);
    setRetryNonce((n) => n + 1);
  }

  async function copyInvite() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  // Leave the lobby. While the game is in progress the server counts any
  // departure as a forfeit (PicrossRoom.onLeave), so route the click through
  // the confirm dialog first; otherwise just go.
  function leaveRoom() {
    if (snapshot?.phase === "playing") {
      setConfirmingAbandon(true);
    } else {
      navigate("/multiplayer/unrated");
    }
  }

  function cancelAbandon() {
    setConfirmingAbandon(false);
  }

  // ── Abandon Confirmation ────────────────────────────────────────────────────

  // Confirmed abandon: mark the leave as intentional so onLeave doesn't flash a
  // "Disconnected" error, drop the Colyseus connection, then navigate away.
  function handleAbandonConfirm() {
    if (snapshot?.phase !== "playing" && snapshot?.phase !== "waiting") return;
    intentionalLeaveRef.current = true;
    try {
      roomRef.current?.leave();
    } catch {
      /* ignore — navigating away regardless */
    }
    roomRef.current = null;
    navigate("/multiplayer/unrated");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <CenteredMessage>
        <Icon name="info" size={28} color="var(--color-coral-400)" />
        <p style={{ color: "var(--color-ink-muted)", margin: "12px 0" }}>
          {error}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="primary" size="sm" onClick={retryConnection}>
            Try again
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/multiplayer/unrated")}
          >
            Back to lobby
          </Button>
        </div>
      </CenteredMessage>
    );
  }

  if (!snapshot) {
    return (
      <CenteredMessage>
        <Icon name="refresh" size={20} color="var(--color-ink-faint)" />
        <span
          style={{
            fontSize: 14,
            color: "var(--color-ink-faint)",
            marginLeft: 8,
          }}
        >
          Connecting…
        </span>
      </CenteredMessage>
    );
  }

  const {
    phase,
    inviteCode,
    width,
    height,
    rowClues,
    colClues,
    players,
    winnerId,
    forfeit,
    colors,
    mode,
  } = snapshot;

  if (phase === "waiting") {
    const playerEntries = Object.entries(players);
    const requiredPlayers = maxPlayersFor(mode);
    const openSlots = Math.max(0, requiredPlayers - playerEntries.length);
    const isTeamMode = mode === "2v2";
    const myTeam = mySessionId ? players[mySessionId]?.team : null;
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--color-paper)",
          padding: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 40,
          }}
        >
          <Button variant="ghost" size="sm" onClick={leaveRoom}>
            <Icon name="arrow-left" size={14} color="var(--color-ink-faint)" />{" "}
            Back
          </Button>
          <Logo size={22} />
          <div style={{ width: 80 }} />
        </div>

        <div
          className="mp-room-waiting-card"
          style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "var(--color-blue-50)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <Icon name="users" size={24} color="var(--color-blue-500)" />
          </div>

          <h1
            style={{
              margin: "0 0 6px",
              fontSize: 26,
              fontWeight: 700,
              color: "var(--color-ink)",
            }}
          >
            Waiting for players
          </h1>
          <p
            style={{
              margin: "0 0 8px",
              color: "var(--color-ink-muted)",
              fontSize: 14,
            }}
          >
            Share the invite code or URL with friends to start.
          </p>
          <p
            style={{
              margin: "0 0 32px",
              color: "var(--color-ink-faint)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {mode} · {playerEntries.length}/{requiredPlayers} players
          </p>

          <div className="mp-surface" style={{ padding: 24, marginBottom: 20 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-ink-faint)",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              INVITE CODE
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: "0.3em",
                color: "var(--color-ink)",
                fontFamily: "var(--font-ui)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {inviteCode}
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => void copyInvite()}
            style={{ width: "100%", marginBottom: 32 }}
          >
            {copied ? "Copied!" : "Copy invite link"}
          </Button>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {playerEntries.map(([id, p]) => {
              // 2v2 only: color-code by team relative to the viewer, no text
              // labels — mirrors the in-match progress rows.
              const teamAccent = isTeamMode
                ? p.team === myTeam
                  ? OWN_TEAM_ACCENT
                  : OTHER_TEAM_ACCENT
                : undefined;
              return (
                <div
                  key={id}
                  className="mp-surface"
                  style={{
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    borderLeft: teamAccent
                      ? `4px solid ${teamAccent}`
                      : undefined,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--color-sage-400)",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--color-ink)",
                    }}
                  >
                    {p.username}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--color-ink-faint)",
                      marginLeft: "auto",
                    }}
                  >
                    Connected
                  </span>
                </div>
              );
            })}
            {Array.from({ length: openSlots }, (_, i) => (
              <div
                key={`open-slot-${i}`}
                className="mp-surface"
                style={{
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: 0.5,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--color-line-strong)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 14, color: "var(--color-ink-muted)" }}>
                  Waiting for player…
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // "playing" or "finished"
  const sessionIds = Object.keys(players);
  const myId = mySessionId ?? sessionIds[0];
  const otherIds = sessionIds.filter((id) => id !== myId);

  const me = players[myId];
  const otherPlayers = otherIds.map((id) => ({ id, ...players[id] }));

  if (!me) {
    return (
      <CenteredMessage>
        <span style={{ color: "var(--color-ink-muted)", fontSize: 14 }}>
          Loading game…
        </span>
      </CenteredMessage>
    );
  }

  const isTeamMode = mode === "2v2";
  const myBoard = boardOf(snapshot, me);
  const myGrid = buildGrid(myBoard);
  const myMistakeCrossIndices = mistakeCrossIndicesOf(myBoard);
  const winnerPlayer = winnerId ? players[winnerId] : null;

  // 2v2: the teammate shares my Team Board, so they get a status line under
  // it rather than a sidebar card; the opposing pair share one card.
  const teammate = isTeamMode
    ? otherPlayers.find((p) => p.team === me.team)
    : undefined;
  const opponents = isTeamMode
    ? otherPlayers.filter((p) => p.team !== me.team)
    : otherPlayers;

  // onLeave/elimination only crowns a survivor who is not already
  // eliminated, so against an opponent (FFA) or opposing team (2v2) that's
  // already out of lives, the match can end with no winner at all.
  const someoneElseCanStillWin = isTeamMode
    ? otherPlayers.some((p) => p.team !== me.team && !p.done)
    : otherPlayers.some((p) => !p.done);
  const myTeammateActive = isTeamMode
    ? otherPlayers.some((p) => p.team === me.team && !p.done)
    : false;

  const isFinished = phase === "finished";
  // 2v2 wins belong to the team as a whole — whoever placed the final cell
  // is never singled out — so the team outcome replaces the individual one.
  const myTeamWon =
    isFinished &&
    isTeamMode &&
    winnerPlayer !== null &&
    winnerPlayer.team === me.team;
  const iWon = isFinished && !isTeamMode && winnerId === myId;
  const someoneElseWon = isFinished && !iWon && !myTeamWon && winnerId !== "";
  const noWinner = isFinished && !winnerId;
  // Whether the winning team actually completed their Team Board, as opposed
  // to winning because the other team left or ran out of lives.
  const winningTeamSolved =
    isTeamMode &&
    winnerPlayer !== null &&
    snapshot.teamBoards?.[String(winnerPlayer.team ?? 0)]?.progress === 1;

  // Abandon-dialog warning, generalized per mode. 1v1 keeps its original
  // wording verbatim (a single named opponent either wins or can't).
  const abandonBody = isTeamMode
    ? myTeammateActive
      ? "Leaving now removes you from your team — your teammate can still win."
      : "Your team has already been eliminated, so leaving now ends the game with no winner."
    : otherPlayers.length > 1
      ? "Leaving now eliminates you from the race."
      : someoneElseCanStillWin
        ? "Leaving now counts as a forfeit, your opponent wins."
        : "Your opponent is already out of lives, so leaving now ends the game with no winner.";

  const cs = autoCellSize(width, height);
  // Height of the column-clue block above a grid's body, so panels beside the
  // board can line up with the cells rather than the clues.
  const clueOffset =
    Math.max(1, ...(colClues ?? [[]]).map((c) => c.length)) * cs;

  return (
    <div
      className="mp-room-page"
      style={{
        minHeight: "100vh",
        background: "var(--color-paper)",
        padding: "24px 24px 80px",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <button
          onClick={leaveRoom}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            color: "var(--color-ink-faint)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Icon name="arrow-left" size={14} color="var(--color-ink-faint)" />
          Lobby
        </button>
        <Logo size={22} />
        <div style={{ width: 80 }} />
      </div>

      <h1
        style={{
          textAlign: "center",
          margin: "0 0 4px",
          fontSize: 24,
          fontWeight: 700,
          color: "var(--color-ink)",
        }}
      >
        Multiplayer
      </h1>
      <p
        style={{
          textAlign: "center",
          margin: "0 0 28px",
          color: "var(--color-ink-muted)",
          fontSize: 13,
        }}
      >
        Left-click to fill · Right-click to mark empty
      </p>

      <div
        className="mp-room-layout"
        style={{
          display: "flex",
          gap: 40,
          justifyContent: "center",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        {/* My board */}
        <div className="mp-room-board">
          <PlayerLabel
            name={`${me.username} (you)`}
            livesLeft={me.livesLeft}
            done={me.done}
            won={me.won}
            isWinner={iWon || myTeamWon}
            team={isTeamMode ? { index: me.team ?? 0, own: true } : undefined}
          />
          <div
            ref={boardWrapRef}
            style={{
              position: "relative",
              width: "fit-content",
              alignSelf: "center",
            }}
          >
            <NonogramGrid
              rowClues={rowClues}
              colClues={colClues}
              grid={myGrid}
              width={width}
              height={height}
              // A done player keeps watching their (Team) Board live, but can't act.
              interactive={!isFinished && !me.done && !reconnecting}
              colors={isFinished ? colors : undefined}
              // Picture Reveal: everyone's board turns into the solved
              // picture when the match ends, whatever their outcome. Keyed
              // on the match ending (not on winning) also means an FFA
              // early finisher gets it: their `won` flipped before the
              // colours arrived, so the reveal never used to fire for them.
              completed={isFinished}
              mistakeCrossIdx={mistakeCrossIdx}
              mistakeCrossIndices={myMistakeCrossIndices}
              onFill={handleFill}
              onCross={handleCross}
            />
            {teammate && (
              <TeammateCursorOverlay
                stream={cursorStream}
                geometry={cursorGeometry}
                visible={!isFinished && !teammate.done && teammate.connected}
                color={OWN_TEAM_ACCENT}
              />
            )}
          </div>
          {teammate && (
            <TeammateLine
              name={teammate.username}
              livesLeft={teammate.livesLeft}
              done={teammate.done}
              connected={teammate.connected}
              teamWon={myTeamWon}
            />
          )}
        </div>

        {/* Sidebar with stats */}
        <div
          className="mp-room-sidebar"
          style={{
            paddingTop: clueOffset,
            display: "flex",
            alignItems: "flex-start",
          }}
        >
          <div
            className="mp-surface"
            style={{
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              minWidth: 160,
            }}
          >
            <StatTile icon="clock" label="Time">
              <span
                style={{
                  fontFamily: "Cairo, sans-serif",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtSeconds(displaySeconds)}
              </span>
            </StatTile>
            <StatTile icon="grid" label="Size">
              {width} × {height}
            </StatTile>
            {phase === "playing" && (
              <>
                <div style={{ height: 1, background: "var(--color-line)" }} />
                <Button variant="danger-soft" size="sm" onClick={leaveRoom}>
                  Abandon
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Other players' progress */}
        {opponents.length > 0 ? (
          <div
            className="mp-room-progress-stack"
            style={{ paddingTop: clueOffset, minWidth: 200 }}
          >
            {isTeamMode ? (
              // The opposing pair share one Team Board, so one card: their
              // board and progress once, each opponent's lives listed below.
              <div className="mp-room-progress">
                <OpponentTeamCard
                  opponents={opponents}
                  board={boardOf(snapshot, opponents[0])}
                  isWinner={isFinished && someoneElseWon}
                  rowClues={rowClues}
                  colClues={colClues}
                  width={width}
                  height={height}
                  revealed={isFinished}
                />
              </div>
            ) : (
              opponents.map((p) => (
                <div key={p.id} className="mp-room-progress">
                  <PlayerProgressRow
                    name={p.username}
                    livesLeft={p.livesLeft}
                    done={p.done}
                    won={p.won}
                    isWinner={isFinished && p.won}
                    rowClues={rowClues}
                    colClues={colClues}
                    width={width}
                    height={height}
                    board={boardOf(snapshot, p)}
                    revealed={isFinished}
                  />
                </div>
              ))
            )}
          </div>
        ) : (
          <div
            className="mp-surface"
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--color-ink-muted)",
              minWidth: 200,
              marginTop: clueOffset,
            }}
          >
            <Icon
              name="users"
              size={24}
              color="var(--color-line-strong)"
              style={{ marginBottom: 8 }}
            />
            <div style={{ fontSize: 13 }}>Waiting for opponent…</div>
          </div>
        )}
      </div>

      {/* Transient connection loss — the seat is held server-side while the
          SDK retries, so this is not (yet) the end of the match. */}
      {reconnecting && (
        <div className="mp-toast">
          <Icon name="refresh" size={16} color="var(--color-butter-300)" />
          <span>Connection lost — reconnecting…</span>
        </div>
      )}

      {/* Outcome banner */}
      {isFinished && (
        <div
          className="mp-outcome-banner"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 32,
            transform: "translateX(-50%)",
            padding: "16px 24px",
            background:
              iWon || myTeamWon
                ? "var(--color-sage-50)"
                : someoneElseWon
                  ? "var(--color-coral-50)"
                  : "var(--color-butter-50)",
            border: `1px solid ${iWon || myTeamWon ? "var(--color-sage-100)" : someoneElseWon ? "var(--color-coral-100)" : "var(--color-butter-100)"}`,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            gap: 16,
            boxShadow: "0 18px 38px -12px rgba(0,0,0,0.15)",
            zIndex: 200,
            whiteSpace: "nowrap",
          }}
        >
          <Icon
            name={iWon || myTeamWon ? "check" : someoneElseWon ? "x" : "info"}
            size={20}
            color={
              iWon || myTeamWon
                ? "var(--color-sage-500)"
                : someoneElseWon
                  ? "var(--color-coral-500)"
                  : "#8a7338"
            }
          />
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: "var(--color-ink)",
              }}
            >
              {iWon
                ? forfeit
                  ? "Opponent left — you win!"
                  : "You win!"
                : myTeamWon
                  ? winningTeamSolved
                    ? "Your team solved it!"
                    : forfeit
                      ? "Opponent left — your team wins!"
                      : "Opponents are out of lives — your team wins!"
                  : someoneElseWon
                    ? isTeamMode
                      ? winningTeamSolved
                        ? `Team ${(winnerPlayer?.team ?? 0) + 1} solved it first`
                        : `Team ${(winnerPlayer?.team ?? 0) + 1} wins`
                      : `${winnerPlayer?.username ?? "Opponent"} wins`
                    : noWinner
                      ? forfeit
                        ? "Opponent left — no winner"
                        : "Everyone's out of lives"
                      : "Game over"}
            </div>
            {(iWon ? !forfeit : myTeamWon && winningTeamSolved) && (
              <div style={{ fontSize: 12, color: "var(--color-sage-500)" }}>
                Solved in {fmtSeconds(displaySeconds)}
              </div>
            )}
            {noWinner && forfeit && me.done && !me.won && (
              <div style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
                You were already out of lives.
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate(
                  isRanked ? "/multiplayer/ranked" : "/multiplayer/unrated",
                )
              }
            >
              Play again
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate("/")}>
              Main menu
            </Button>
          </div>
        </div>
      )}

      {/* Abandon confirmation. Rendered only while the match is still live so
          a game that ends on its own takes the dialog down with it. */}
      {confirmingAbandon && phase === "playing" && (
        <ConfirmDialog
          titleId="abandon-title"
          title="Abandon this game?"
          body={abandonBody}
          confirmLabel="Abandon"
          onConfirm={handleAbandonConfirm}
          onCancel={cancelAbandon}
        />
      )}
    </div>
  );
}

// ── Small sub-components ──────────────────────────────────────────────────────

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 8,
        background: "var(--color-paper)",
      }}
    >
      {children}
    </div>
  );
}

interface TeamTag {
  /** 0-based team index; shown 1-based, matching the "Team N" banners. */
  index: number;
  own: boolean;
}

// 2v2: names the Team Board a player is looking at, in the same own/opposing
// colours as the board borders, so "Team 2 solved it first" has something
// on screen to refer to.
function TeamChip({ index, own }: TeamTag) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: own ? "var(--color-sage-500)" : "var(--color-coral-500)",
        background: own ? "var(--color-sage-50)" : "var(--color-coral-50)",
        border: `1px solid ${own ? "var(--color-sage-100)" : "var(--color-coral-100)"}`,
        borderRadius: 999,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      Team {index + 1}
    </span>
  );
}

function PlayerLabel({
  name,
  livesLeft,
  done,
  won,
  isWinner,
  team,
}: {
  name: string;
  livesLeft: number;
  done: boolean;
  won: boolean;
  isWinner: boolean;
  /** 2v2 only: which team this board belongs to. */
  team?: TeamTag;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 10,
        minHeight: 32,
      }}
    >
      {team && <TeamChip {...team} />}
      <span
        style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink)" }}
      >
        {name}
      </span>
      {isWinner && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--color-sage-500)",
            background: "var(--color-sage-50)",
            border: "1px solid var(--color-sage-100)",
            borderRadius: 999,
            padding: "2px 8px",
          }}
        >
          Winner
        </span>
      )}
      {done && !won && !isWinner && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--color-coral-500)",
            background: "var(--color-coral-50)",
            border: "1px solid var(--color-coral-100)",
            borderRadius: 999,
            padding: "2px 8px",
          }}
        >
          Eliminated
        </span>
      )}
      <div style={{ marginLeft: "auto" }}>
        <LivesPips lives={livesLeft} />
      </div>
    </div>
  );
}

interface BoardPreviewProps {
  rowClues: number[][];
  colClues: number[][];
  width: number;
  height: number;
  board: BoardSnapshot;
  /** True once the match has ended — un-blurs the board (no color reveal). */
  revealed: boolean;
  completed: boolean;
}

// Someone else's board in miniature, blurred until the match ends.
function BlurredBoard({
  rowClues,
  colClues,
  width,
  height,
  board,
  revealed,
  completed,
}: BoardPreviewProps) {
  return (
    <div
      style={{
        // A blur is the only thing standing between a viewer and this
        // board — the server sends it in full (see PicrossRoom's
        // buildSnapshot).
        filter: revealed ? "none" : "blur(16px)",
        transition: "filter 0.6s ease",
        overflow: "hidden",
        borderRadius: 6,
        marginBottom: 8,
      }}
    >
      <NonogramGrid
        rowClues={rowClues}
        colClues={colClues}
        grid={buildGrid(board)}
        width={width}
        height={height}
        interactive={false}
        hideGridlines={!revealed}
        hideClues={!revealed}
        completed={completed}
        mistakeCrossIndices={mistakeCrossIndicesOf(board)}
        cellSize={12}
      />
    </div>
  );
}

function ProgressBar({
  progress,
  isWinner,
}: {
  progress: number;
  isWinner: boolean;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <>
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "var(--color-line)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 999,
            background: isWinner
              ? "var(--color-sage-400)"
              : "var(--color-blue-400)",
            transition: "width 200ms ease",
          }}
        />
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 12,
          color: "var(--color-ink-faint)",
          textAlign: "right",
        }}
      >
        {pct}%
      </div>
    </>
  );
}

// FFA: one card per opponent — their blurred board, lives/status, progress.
function PlayerProgressRow({
  name,
  livesLeft,
  done,
  won,
  isWinner,
  board,
  ...preview
}: Omit<BoardPreviewProps, "completed"> & {
  name: string;
  livesLeft: number;
  done: boolean;
  won: boolean;
  isWinner: boolean;
}) {
  return (
    <div className="mp-surface" style={{ padding: "16px 20px" }}>
      <BlurredBoard {...preview} board={board} completed={won} />
      <PlayerLabel
        name={name}
        livesLeft={livesLeft}
        done={done}
        won={won}
        isWinner={isWinner}
      />
      <ProgressBar progress={board.progress} isWinner={isWinner} />
    </div>
  );
}

// 2v2: the opposing team as a single card, since both opponents play the
// same Team Board. Lives stay per-player, so each opponent is listed with
// their own. Colour alone (coral border) marks it as the other team — no
// "Opponents" text label, per design.
function OpponentTeamCard({
  opponents,
  board,
  isWinner,
  rowClues,
  colClues,
  width,
  height,
  revealed,
}: {
  opponents: Array<PlayerSnapshot & { id: string }>;
  board: BoardSnapshot;
  isWinner: boolean;
  rowClues: number[][];
  colClues: number[][];
  width: number;
  height: number;
  revealed: boolean;
}) {
  return (
    <div
      className="mp-surface"
      style={{
        padding: "16px 20px",
        borderLeft: `4px solid ${OTHER_TEAM_ACCENT}`,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <TeamChip index={opponents[0]?.team ?? 0} own={false} />
      </div>
      <BlurredBoard
        rowClues={rowClues}
        colClues={colClues}
        width={width}
        height={height}
        board={board}
        revealed={revealed}
        completed={isWinner && board.progress === 1}
      />
      <ProgressBar progress={board.progress} isWinner={isWinner} />
      <div style={{ marginTop: 8 }}>
        {opponents.map((p) => (
          <PlayerLabel
            key={p.id}
            name={p.connected ? p.username : `${p.username} (reconnecting…)`}
            livesLeft={p.livesLeft}
            done={p.done}
            won={p.won}
            isWinner={isWinner}
          />
        ))}
      </div>
    </div>
  );
}

// 2v2: the teammate shares the board directly above, so no mini-board —
// just who they are, their own lives, and whether they're still in.
function TeammateLine({
  name,
  livesLeft,
  done,
  connected,
  teamWon,
}: {
  name: string;
  livesLeft: number;
  done: boolean;
  connected: boolean;
  teamWon: boolean;
}) {
  return (
    <div
      style={{
        marginTop: 12,
        paddingLeft: 12,
        borderLeft: `4px solid ${OWN_TEAM_ACCENT}`,
      }}
    >
      <PlayerLabel
        name={connected ? name : `${name} (reconnecting…)`}
        livesLeft={livesLeft}
        done={done}
        won={teamWon}
        isWinner={teamWon}
      />
    </div>
  );
}
