import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  confirmedFilled: boolean[];
  crosses: boolean[];
  revealedEmpty: boolean[];
  livesLeft: number;
  done: boolean;
  won: boolean;
  /** False while the player is inside their server-side reconnection window. */
  connected: boolean;
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
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildGrid(p: PlayerSnapshot): CellValue[] {
  return cellsToGrid(p.confirmedFilled, p.crosses, p.revealedEmpty);
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
  const { status, playerName } = useAuth();

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
  } = snapshot;

  if (phase === "waiting") {
    const playerList = Object.values(players);
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

        <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
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
            Waiting for opponent
          </h1>
          <p
            style={{
              margin: "0 0 32px",
              color: "var(--color-ink-muted)",
              fontSize: 14,
            }}
          >
            Share the invite code or URL with a friend to start.
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
            {playerList.map((p, i) => (
              <div
                key={i}
                className="mp-surface"
                style={{
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
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
            ))}
            {playerList.length < 2 && (
              <div
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
                  Waiting for player 2…
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // "playing" or "finished"
  const sessionIds = Object.keys(players);
  const myId = mySessionId ?? sessionIds[0];
  const opponentId = sessionIds.find((id) => id !== myId) ?? null;

  const me = players[myId];
  const opponent = opponentId ? players[opponentId] : null;

  if (!me) {
    return (
      <CenteredMessage>
        <span style={{ color: "var(--color-ink-muted)", fontSize: 14 }}>
          Loading game…
        </span>
      </CenteredMessage>
    );
  }

  const myGrid = buildGrid(me);
  const opponentGrid = opponent ? buildGrid(opponent) : null;

  // onLeave only crowns a survivor who is not already eliminated, so against
  // an opponent who is out of lives the match ends with no winner at all.
  const opponentCanWin = opponent !== null && !opponent.done;

  const isFinished = phase === "finished";
  const iWon = isFinished && winnerId === myId;
  const opponentWon =
    isFinished && opponentId !== null && winnerId === opponentId;
  const noWinner = isFinished && !winnerId;

  const cs = autoCellSize(width, height);
  // Height of the column-clue block above a grid's body, so panels beside the
  // board can line up with the cells rather than the clues.
  const clueOffset =
    Math.max(1, ...(colClues ?? [[]]).map((c) => c.length)) * cs;

  return (
    <div
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
        style={{
          display: "flex",
          gap: 40,
          justifyContent: "center",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        {/* My board */}
        <div>
          <PlayerLabel
            name={`${me.username} (you)`}
            livesLeft={me.livesLeft}
            done={me.done}
            won={me.won}
            isWinner={iWon}
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
            onFill={handleFill}
            onCross={handleCross}
          />
        </div>

        {/* Sidebar with stats */}
        <div
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

        {/* Opponent board */}
        {opponent && opponentGrid ? (
          <div>
            <PlayerLabel
              name={opponent.username}
              livesLeft={opponent.livesLeft}
              done={opponent.done}
              won={opponent.won}
              isWinner={opponentWon}
            />
            <div
              style={{
                // Heavier than it looks like it needs to be on purpose: the
                // server sends the opponent's real cells, so the blur is the
                // only thing standing between a viewer and their board.
                filter: isFinished ? "none" : "blur(16px)",
                transition: "filter 0.6s ease",
                overflow: "hidden",
                borderRadius: 6,
              }}
            >
              <NonogramGrid
                rowClues={rowClues}
                colClues={colClues}
                grid={opponentGrid}
                width={width}
                height={height}
                interactive={false}
                // Both come back with the reveal at the end of the match.
                hideGridlines={!isFinished}
                hideClues={!isFinished}
                colors={isFinished ? colors : undefined}
                completed={opponent.won}
                cellSize={Math.max(12, cs - 8)}
              />
            </div>
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
          style={{
            position: "fixed",
            left: "50%",
            bottom: 32,
            transform: "translateX(-50%)",
            padding: "16px 24px",
            background: iWon
              ? "var(--color-sage-50)"
              : opponentWon
                ? "var(--color-coral-50)"
                : "var(--color-butter-50)",
            border: `1px solid ${iWon ? "var(--color-sage-100)" : opponentWon ? "var(--color-coral-100)" : "var(--color-butter-100)"}`,
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
            name={iWon ? "check" : opponentWon ? "x" : "info"}
            size={20}
            color={
              iWon
                ? "var(--color-sage-500)"
                : opponentWon
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
                : opponentWon
                  ? `${opponent?.username ?? "Opponent"} wins`
                  : noWinner
                    ? forfeit
                      ? "Opponent left — no winner"
                      : "Both players out of lives"
                    : "Game over"}
            </div>
            {iWon && !forfeit && (
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
              onClick={() => navigate("/multiplayer/unrated")}
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
          body={
            opponentCanWin
              ? "Leaving now counts as a forfeit, your opponent wins."
              : "Your opponent is already out of lives, so leaving now ends the game with no winner."
          }
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

function PlayerLabel({
  name,
  livesLeft,
  done,
  won,
  isWinner,
}: {
  name: string;
  livesLeft: number;
  done: boolean;
  won: boolean;
  isWinner: boolean;
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
