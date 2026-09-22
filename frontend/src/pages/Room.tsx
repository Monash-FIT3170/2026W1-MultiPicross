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

// ── Types ────────────────────────────────────────────────────────────────────

interface PlayerSnapshot {
  username: string;
  /** Present only in the snapshot sent to this player's own client. */
  confirmedFilled?: boolean[];
  crosses?: boolean[];
  revealedEmpty?: boolean[];
  mistakeCross?: boolean[];
  livesLeft: number;
  done: boolean;
  won: boolean;
  /** False while the player is inside their server-side reconnection window. */
  connected: boolean;
  team: number | null;
  /** Fraction (0-1) of the puzzle's filled cells this player has correctly filled. */
  progress: number;
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
  finishOrder: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Board arrays are only ever present in the snapshot for the viewer's own
// player, so this only makes sense to call on `me` — never on another player.
function buildGrid(p: Required<Pick<PlayerSnapshot, "confirmedFilled" | "crosses" | "revealedEmpty">>): CellValue[] {
  return cellsToGrid(p.confirmedFilled, p.crosses, p.revealedEmpty);
}

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

        // Sent only to the player who made the mistake.
        room.onMessage<{ idx: number }>("mistake", (msg) => {
          if (cancelled) return;
          setMistakeCrossIdx(msg.idx);
          window.clearTimeout(mistakeCrossTimerRef.current);
          mistakeCrossTimerRef.current = window.setTimeout(() => {
            setMistakeCrossIdx(null);
          }, 450);
        });

        // A drop is not a leave: the SDK re-establishes the session while the server
        // holds the seat, so show it as transient.
        room.onDrop(() => {
          if (!cancelled) setReconnecting(true);
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
    };
  }, [roomId, authReady, retryNonce]);

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
                  ? "var(--color-sage-400)"
                  : "var(--color-coral-400)"
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

  // `me` always carries board arrays — it's the viewer's own player.
  const myGrid = buildGrid({
    confirmedFilled: me.confirmedFilled ?? [],
    crosses: me.crosses ?? [],
    revealedEmpty: me.revealedEmpty ?? [],
  });
  const myMistakeCrossIndices = (me.mistakeCross ?? []).reduce<number[]>(
    (acc, v, i) => {
      if (v) acc.push(i);
      return acc;
    },
    [],
  );

  const isTeamMode = mode === "2v2";
  const winnerPlayer = winnerId ? players[winnerId] : null;

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
  const iWon = isFinished && winnerId === myId;
  // 2v2: a teammate finishing wins the match for the whole team, including me.
  const myTeamWon =
    isFinished &&
    !iWon &&
    isTeamMode &&
    winnerPlayer !== null &&
    winnerPlayer.team === me.team;
  const someoneElseWon = isFinished && !iWon && !myTeamWon && winnerId !== "";
  const noWinner = isFinished && !winnerId;

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

  // FFA only: 1st/2nd/3rd/... place for whoever's actually finished, in
  // completion order. Team modes and non-finishers have no placement.
  const placementOf = (sessionId: string): number | null => {
    if (isTeamMode) return null;
    const idx = snapshot.finishOrder.indexOf(sessionId);
    return idx === -1 ? null : idx + 1;
  };

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
            isWinner={iWon}
            placement={placementOf(myId)}
          />
          <NonogramGrid
            rowClues={rowClues}
            colClues={colClues}
            grid={myGrid}
            width={width}
            height={height}
            interactive={!isFinished && !me.done && !reconnecting}
            colors={isFinished ? colors : undefined}
            completed={me.won}
            mistakeCrossIdx={mistakeCrossIdx}
            mistakeCrossIndices={myMistakeCrossIndices}
            onFill={handleFill}
            onCross={handleCross}
          />
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
        {otherPlayers.length > 0 ? (
          <div
            className="mp-room-progress-stack"
            style={{ paddingTop: clueOffset, minWidth: 200 }}
          >
            {otherPlayers.map((p) => {
              const rowWon = isFinished && p.won;
              // 2v2 only: color-code by team relative to the viewer, no text
              // labels — own team gets a sage accent, opposing team coral.
              const teamAccent = isTeamMode
                ? p.team === me.team
                  ? "var(--color-sage-400)"
                  : "var(--color-coral-400)"
                : undefined;
              return (
                <div key={p.id} className="mp-room-progress">
                  <PlayerProgressRow
                    name={p.username}
                    livesLeft={p.livesLeft}
                    done={p.done}
                    won={p.won}
                    isWinner={rowWon}
                    progress={p.progress}
                    placement={placementOf(p.id)}
                    accentColor={teamAccent}
                  />
                </div>
              );
            })}
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
                  ? forfeit
                    ? "Opponent left — your team wins!"
                    : `${winnerPlayer?.username ?? "Your teammate"} finished — your team wins!`
                  : someoneElseWon
                    ? isTeamMode
                      ? `Team ${(winnerPlayer?.team ?? 0) + 1} wins`
                      : `${winnerPlayer?.username ?? "Opponent"} wins`
                    : noWinner
                      ? forfeit
                        ? "Opponent left — no winner"
                        : "Everyone's out of lives"
                      : "Game over"}
            </div>
            {(iWon || myTeamWon) && !forfeit && (
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

function ordinal(n: number): string {
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : (suffixes[n % 10] ?? "th");
  return `${n}${suffix}`;
}

function PlayerLabel({
  name,
  livesLeft,
  done,
  won,
  isWinner,
  placement,
}: {
  name: string;
  livesLeft: number;
  done: boolean;
  won: boolean;
  isWinner: boolean;
  placement?: number | null;
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
      {!isWinner && placement != null && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--color-blue-500)",
            background: "var(--color-blue-50)",
            border: "1px solid var(--color-blue-100)",
            borderRadius: 999,
            padding: "2px 8px",
          }}
        >
          {ordinal(placement)}
        </span>
      )}
      {done && !won && !isWinner && placement == null && (
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

// Represents any player other than the viewer: a progress bar plus lives and
// status, instead of their actual board — the server no longer sends board
// data for anyone but the viewer's own player (see PicrossRoom's per-client
// snapshot scoping), so there is nothing else to render for them.
//
// `accentColor`, when set (2v2 only), color-codes the row's left border by
// team membership relative to the viewer — sage for the viewer's own team,
// coral for the opposing team. No text label ("Your Team"/"Opponents") is
// used; color alone is the distinguishing signal, per design.
function PlayerProgressRow({
  name,
  livesLeft,
  done,
  won,
  isWinner,
  progress,
  placement,
  accentColor,
}: {
  name: string;
  livesLeft: number;
  done: boolean;
  won: boolean;
  isWinner: boolean;
  progress: number;
  placement?: number | null;
  accentColor?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div
      className="mp-surface"
      style={{
        padding: "16px 20px",
        borderLeft: accentColor ? `4px solid ${accentColor}` : undefined,
      }}
    >
      <PlayerLabel
        name={name}
        livesLeft={livesLeft}
        done={done}
        won={won}
        isWinner={isWinner}
        placement={placement ?? null}
      />
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
    </div>
  );
}
