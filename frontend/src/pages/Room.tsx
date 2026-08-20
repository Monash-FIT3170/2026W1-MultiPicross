import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Room as ColyseusRoom } from "@colyseus/sdk";
import { gameserverClient } from "../colyseus";
import { useAuth } from "../auth/AuthContext";
import NonogramGrid, {
  type CellValue,
  autoCellSize,
  fmtSeconds,
} from "../components/NonogramGrid";
import {
  Logo,
  Icon,
  Button,
  LivesPips,
  StatTile,
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


const OPPONENT_BOARD_DELAY_MS = 5000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildGrid(p: PlayerSnapshot): CellValue[] {
  return p.confirmedFilled.map((filled, i) => {
    if (filled) return 1;
    if (p.revealedEmpty[i]) return 3;
    if (p.crosses[i]) return 2;
    return 0;
  });
}

// ── Main component ───────────────────────────────────────────────────────────

export function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { status, username: authUsername } = useAuth();

  const roomRef = useRef<ColyseusRoom | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const playingStartRef = useRef<number | null>(null);
  const [delayedOpponentGrid, setDelayedOpponentGrid] = useState<
    CellValue[] | null
  >(null);
  const opponentDelayTimers = useRef<number[]>([]);

  // ── Connect to room ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId || status === "loading") return;

    let cancelled = false;

    async function connect() {
      try {
        const username =
          status === "authenticated" && authUsername ? authUsername : "Guest";

        const room = await gameserverClient.joinById(roomId!, { username });

        if (cancelled) {
          room.leave();
          return;
        }

        roomRef.current = room;
        setMySessionId(room.sessionId);

        room.onMessage<RoomSnapshot>("state", (msg) => {
          setSnapshot(msg);
        });

        room.onLeave(() => {
          if (!cancelled) setError("Disconnected from room.");
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
      roomRef.current?.leave();
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, status]);

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

  // ── Delayed opponent board ────────────────────────────────────────────────
  // Each new snapshot schedules its own delayed apply rather than debouncing,
  // so the board keeps catching up smoothly instead of stalling while the
  // opponent is actively filling cells.

  useEffect(() => {
    const sessionIds = snapshot ? Object.keys(snapshot.players) : [];
    const myId = mySessionId ?? sessionIds[0];
    const opponentId = sessionIds.find((id) => id !== myId) ?? null;
    const opponentSnap =
      snapshot && opponentId ? snapshot.players[opponentId] : null;

    if (!opponentSnap) {
      setDelayedOpponentGrid(null);
      return;
    }

    const grid = buildGrid(opponentSnap);
    const id: number = window.setTimeout(() => {
      setDelayedOpponentGrid(grid);
      opponentDelayTimers.current = opponentDelayTimers.current.filter(
        (t: number) => t !== id,
      );
    }, OPPONENT_BOARD_DELAY_MS);
    opponentDelayTimers.current.push(id);
  }, [snapshot, mySessionId]);

  useEffect(() => {
    return () => {
      opponentDelayTimers.current.forEach((id: number) => window.clearTimeout(id));
    };
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  function handleFill(row: number, col: number) {
    roomRef.current?.send("fill", { row, col });
  }

  function handleCross(row: number, col: number, markCross: boolean) {
    roomRef.current?.send("cross", { row, col, markCross });
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

  // ── Render ─────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <CenteredMessage>
        <Icon name="info" size={28} color="var(--color-coral-400)" />
        <p style={{ color: "var(--color-ink-muted)", margin: "12px 0" }}>
          {error}
        </p>
        <Button variant="primary" size="sm" onClick={() => navigate("/multiplayer")}>
          Back to lobby
        </Button>
      </CenteredMessage>
    );
  }

  if (!snapshot) {
    return (
      <CenteredMessage>
        <Icon name="refresh" size={20} color="var(--color-ink-faint)" />
        <span style={{ fontSize: 14, color: "var(--color-ink-faint)", marginLeft: 8 }}>
          Connecting…
        </span>
      </CenteredMessage>
    );
  }

  const { phase, inviteCode, width, height, rowClues, colClues, players, winnerId, forfeit, colors } = snapshot;

  if (phase === "waiting") {
    const playerList = Object.values(players);
    return (
      <div style={{ minHeight: "100vh", background: "var(--color-paper)", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
          <Button variant="ghost" size="sm" onClick={() => navigate("/multiplayer")}>
            <Icon name="arrow-left" size={14} color="var(--color-ink-faint)" />
            {" "}Back
          </Button>
          <Logo size={22} />
          <div style={{ width: 80 }} />
        </div>

        <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 16,
              background: "var(--color-blue-50)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <Icon name="users" size={24} color="var(--color-blue-500)" />
          </div>

          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: "var(--color-ink)" }}>
            Waiting for opponent
          </h1>
          <p style={{ margin: "0 0 32px", color: "var(--color-ink-muted)", fontSize: 14 }}>
            Share the invite code or URL with a friend to start.
          </p>

          <div className="mp-surface" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink-faint)", letterSpacing: "0.08em", marginBottom: 10 }}>
              INVITE CODE
            </div>
            <div
              style={{
                fontSize: 36, fontWeight: 800, letterSpacing: "0.3em",
                color: "var(--color-ink)", fontFamily: "var(--font-ui)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {inviteCode}
            </div>
          </div>

          <Button variant="primary" size="md" onClick={() => void copyInvite()} style={{ width: "100%", marginBottom: 32 }}>
            {copied ? "Copied!" : "Copy invite link"}
          </Button>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {playerList.map((p, i) => (
              <div
                key={i}
                className="mp-surface"
                style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}
              >
                <div
                  style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "var(--color-sage-400)", flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>
                  {p.username}
                </span>
                <span style={{ fontSize: 12, color: "var(--color-ink-faint)", marginLeft: "auto" }}>
                  Connected
                </span>
              </div>
            ))}
            {playerList.length < 2 && (
              <div
                className="mp-surface"
                style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, opacity: 0.5 }}
              >
                <div
                  style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "var(--color-line-strong)", flexShrink: 0,
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
        <span style={{ color: "var(--color-ink-muted)", fontSize: 14 }}>Loading game…</span>
      </CenteredMessage>
    );
  }

  const myGrid = buildGrid(me);
  const opponentGrid = opponent ? buildGrid(opponent) : null;

  const isFinished = phase === "finished";
  // While the game is live, render the delayed snapshot so the blurred board
  // trails the opponent's actual moves; once finished, snap to the real grid
  // immediately so the reveal isn't held back by a stale timer.
  const displayedOpponentGrid = isFinished
    ? opponentGrid
    : (delayedOpponentGrid ?? opponentGrid);
  const iWon = isFinished && winnerId === myId;
  const opponentWon = isFinished && winnerId === opponentId;
  const isDraw = isFinished && !winnerId;

  const cs = autoCellSize(width, height);

  const totalSolutionCells = rowClues
    .flat()
    .reduce((sum, clue) => sum + clue, 0);
  const myProgress = getProgress(me);
  const opponentProgress = opponent ? getProgress(opponent) : 0;

  function getProgress(player: PlayerSnapshot) {
    const filled = player.confirmedFilled.filter(Boolean).length;
    return totalSolutionCells === 0 ? 0 : filled / totalSolutionCells;
  }

  function ProgressBar({ value }: { value: number }) {
    return (
      <div
        style={{
          width: "100%",
          height: 8,
          background: "var(--color-line)",
          borderRadius: 999,
          overflow: "hidden",
          marginTop: 8,
        }}
      >
        <div
          style={{
            width: `${Math.round(value * 100)}%`,
            height: "100%",
            background: "var(--color-sage-500)",
            transition: "width 0.2s ease",
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-paper)", padding: "24px 24px 80px", overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <button
          onClick={() => navigate("/multiplayer")}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            color: "var(--color-ink-faint)", fontSize: 13,
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <Icon name="arrow-left" size={14} color="var(--color-ink-faint)" />
          Lobby
        </button>
        <Logo size={22} />
        <div style={{ width: 80 }} />
      </div>

      <h1 style={{ textAlign: "center", margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "var(--color-ink)" }}>
        Multiplayer
      </h1>
      <p style={{ textAlign: "center", margin: "0 0 28px", color: "var(--color-ink-muted)", fontSize: 13 }}>
        Left-click to fill · Right-click to mark empty
      </p>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "flex-start", flexWrap: "nowrap", minWidth: "max-content" }}>
        {/* My board */}
        <div>
          <PlayerLabel
            name={`${me.username} (you)`}
            livesLeft={me.livesLeft}
            done={me.done}
            won={me.won}
            isWinner={iWon}
          />
          <ProgressBar value={myProgress} />
          <NonogramGrid
            rowClues={rowClues}
            colClues={colClues}
            grid={myGrid}
            width={width}
            height={height}
            interactive={!isFinished && !me.done}
            colors={isFinished ? colors : undefined}
            completed={me.won}
            onFill={handleFill}
            onCross={handleCross}
          />
        </div>

        {/* Sidebar with stats */}
        <div
          style={{
            paddingTop: Math.max(1, ...(colClues ?? [[]]).map((c) => c.length)) * cs,
            display: "flex",
            alignItems: "flex-start",
          }}
        >
          <div className="mp-surface" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20, minWidth: 160 }}>
            <StatTile icon="clock" label="Time">
              <span style={{ fontFamily: "Cairo, sans-serif", fontVariantNumeric: "tabular-nums" }}>
                {fmtSeconds(displaySeconds)}
              </span>
            </StatTile>
            <StatTile icon="grid" label="Size">
              {width} × {height}
            </StatTile>
          </div>
        </div>

        {/* Opponent board */}
        {opponent && displayedOpponentGrid ? (
          <div>
            <PlayerLabel
              name={opponent.username}
              livesLeft={opponent.livesLeft}
              done={opponent.done}
              won={opponent.won}
              isWinner={opponentWon}
            />
            <ProgressBar value={opponentProgress} />
            <div
              style={{
                filter: isFinished ? "none" : "blur(8px)",
                transition: "filter 0.6s ease",
                overflow: "hidden",
                borderRadius: 6,
              }}
            >
              <NonogramGrid
                rowClues={rowClues}
                colClues={colClues}
                grid={displayedOpponentGrid}
                width={width}
                height={height}
                interactive={false}
                colors={isFinished ? colors : undefined}
                completed={opponent.won}
                cellSize={Math.max(8, cs - 12)}
                showGridLines={false
                }
              />
            </div>
          </div>
        ) : (
          <div
            className="mp-surface"
            style={{
              padding: 40, textAlign: "center", color: "var(--color-ink-muted)",
              minWidth: 200,
              marginTop: Math.max(1, ...(colClues ?? [[]]).map((c) => c.length)) * cs,
            }}
          >
            <Icon name="users" size={24} color="var(--color-line-strong)" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>Waiting for opponent…</div>
          </div>
        )}
      </div>

      {/* Outcome banner */}
      {isFinished && (
        <div
          style={{
            position: "fixed", left: "50%", bottom: 32,
            transform: "translateX(-50%)",
            padding: "16px 24px",
            background: iWon
              ? "var(--color-sage-50)"
              : opponentWon
                ? "var(--color-coral-50)"
                : "var(--color-butter-50)",
            border: `1px solid ${iWon ? "var(--color-sage-100)" : opponentWon ? "var(--color-coral-100)" : "var(--color-butter-100)"}`,
            borderRadius: 14,
            display: "flex", alignItems: "center", gap: 16,
            boxShadow: "0 18px 38px -12px rgba(0,0,0,0.15)",
            zIndex: 200, whiteSpace: "nowrap",
          }}
        >
          <Icon
            name={iWon ? "check" : opponentWon ? "x" : "info"}
            size={20}
            color={iWon ? "var(--color-sage-500)" : opponentWon ? "var(--color-coral-500)" : "#8a7338"}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--color-ink)" }}>
              {iWon
                ? "You win!"
                : opponentWon
                  ? forfeit
                    ? "Opponent left — you win!"
                    : `${opponent?.username ?? "Opponent"} wins`
                  : isDraw
                    ? "Both players out of lives"
                    : "Game over"}
            </div>
            {iWon && (
              <div style={{ fontSize: 12, color: "var(--color-sage-500)" }}>
                Solved in {fmtSeconds(displaySeconds)}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={() => navigate("/multiplayer")}>
              Play again
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate("/")}>
              Main menu
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small sub-components ──────────────────────────────────────────────────────

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", flexDirection: "column", gap: 8,
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
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 10, minHeight: 32,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink)" }}>
        {name}
      </span>
      {isWinner && (
        <span
          style={{
            fontSize: 11, fontWeight: 700,
            color: "var(--color-sage-500)",
            background: "var(--color-sage-50)",
            border: "1px solid var(--color-sage-100)",
            borderRadius: 999, padding: "2px 8px",
          }}
        >
          Winner
        </span>
      )}
      {done && !won && !isWinner && (
        <span
          style={{
            fontSize: 11, fontWeight: 700,
            color: "var(--color-coral-500)",
            background: "var(--color-coral-50)",
            border: "1px solid var(--color-coral-100)",
            borderRadius: 999, padding: "2px 8px",
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
