import { useNavigate } from "react-router-dom";
import { BackButton, Button, Logo, Icon } from "../components/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "@colyseus/sdk";
import { gameserverClient } from "../colyseus";
import { apiFetch } from "../api/client";
import {
  useMyRankedStats,
  useRankedLeaderboard,
  type RankedStats,
} from "../api/rankedStats";
import { useAuth } from "../auth/AuthContext";
import statsIcon from "../assets/stats.svg";
import trophyIcon from "../assets/trophy.svg";
import shieldIcon from "../assets/shield.svg";

const RANKED_BOARD_SIZES = [5, 10, 15, 20] as const;
type RankedBoardSize = (typeof RANKED_BOARD_SIZES)[number];

export function RankedMultiplayer() {
  const navigate = useNavigate();
  const { status } = useAuth();
  const isAuth = status === "authenticated";
  const [selectedBoardSize, setSelectedBoardSize] =
    useState<RankedBoardSize>(15);
  const [searching, setSearching] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<RankedStats | null>(
    null,
  );
  const [queueMessage, setQueueMessage] = useState(
    "We've been unable to find an opponent.",
  );
  const queueRoomRef = useRef<Room | null>(null);
  const { entries: leaderboard, loading: leaderboardLoading } =
    useRankedLeaderboard();
  const { stats: myStats, loading: myStatsLoading } = useMyRankedStats(isAuth);

  const leaveQueueRoom = useCallback(() => {
    const room = queueRoomRef.current;
    if (!room) return;

    queueRoomRef.current = null;
    room.send("leaveQueue");
    void room.leave();
  }, []);

  useEffect(() => leaveQueueRoom, [leaveQueueRoom]);

  const startSearching = async () => {
    if (queueRoomRef.current) return;

    setSearching(true);
    setTimedOut(false);
    setRequiresLogin(false);
    setQueueMessage("We've been unable to find an opponent.");

    try {
      const res = await apiFetch("/auth/room-token", { method: "POST" });
      if (!res.ok) {
        throw new Error(`room token request failed with ${res.status}`);
      }
      const { token } = (await res.json()) as { token: string };

      const room = await gameserverClient.joinOrCreate("rated_matchmaking", {
        token,
      });
      queueRoomRef.current = room;

      room.onMessage("queueStatus", (message: { status?: string }) => {
        if (message.status === "queued") {
          setSearching(true);
          setTimedOut(false);
        }
        if (message.status === "left") {
          setSearching(false);
          setTimedOut(false);
        }
      });

      room.onMessage(
        "matched",
        ({ roomId, boardSize }: { roomId: string; boardSize?: number }) => {
          queueRoomRef.current = null;
          setSearching(false);
          setTimedOut(false);
          void room.leave();
          navigate(
            `/room/${roomId}?mode=ranked${boardSize ? `&size=${boardSize}` : ""}`,
          );
        },
      );

      room.onMessage("queueTimeoutEmpty", () => {
        setSearching(false);
        setRequiresLogin(false);
        setQueueMessage("We've been unable to find an opponent.");
        setTimedOut(true);
      });

      room.onMessage("queueError", (message: { error?: string }) => {
        setSearching(false);
        setRequiresLogin(false);
        setQueueMessage(message.error ?? "Unable to join ranked queue.");
        setTimedOut(true);
      });

      room.onLeave(() => {
        if (queueRoomRef.current === room) queueRoomRef.current = null;
      });

      room.send("joinQueue", { boardSize: selectedBoardSize });
    } catch (error) {
      console.error("Failed to join ranked matchmaking:", error);
      queueRoomRef.current = null;
      setSearching(false);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isUnauthorized =
        errorMessage.includes("401") ||
        errorMessage.toLowerCase().includes("unauthorized");
      setRequiresLogin(isUnauthorized);
      setQueueMessage(
        isUnauthorized
          ? "Please login to play Ranked"
          : "We've been unable to find an opponent.",
      );
      setTimedOut(true);
    }
  };

  const keepSearching = () => {
    const room = queueRoomRef.current;

    if (!room) {
      void startSearching();
      return;
    }

    setSearching(true);
    setTimedOut(false);
    setRequiresLogin(false);
    setQueueMessage("We've been unable to find an opponent.");
    room.send("stayInQueue", { boardSize: selectedBoardSize });
  };

  const cancelSearching = () => {
    leaveQueueRoom();
    setSearching(false);
    setTimedOut(false);
  };

  return (
    <div
      className="mp-page mp-ranked-page"
      style={{
        minHeight: "100vh",
        background: "var(--color-paper)",
        padding: "24px",
      }}
    >
      <div
        className="mp-topbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
          position: "relative",
        }}
      >
        <div style={{ position: "relative" }}>
          <BackButton onClick={() => navigate("/")} label="Main Menu" />
        </div>

        <Logo size={34} />

        <div style={{ width: 100 }} />
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1
          style={{
            margin: "0 0 4px",
            fontSize: 30,
            fontWeight: 700,
            color: "var(--color-ink)",
            letterSpacing: "-0.01em",
          }}
        >
          Picross Ranked
        </h1>

        <p
          style={{
            margin: "0 0 28px",
            color: "var(--color-ink-muted)",
            fontSize: 15,
          }}
        >
          Complete. Climb. Conquer.
        </p>

        <div
          className="mp-ranked-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2fr",
            gap: 16,
            marginBottom: 40,
          }}
        >
          <div
            className="mp-surface mp-ranked-stats"
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              background:
                "linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-sunk) 100%)",
              border: "1px solid var(--color-line)",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--color-ink)",
              }}
            >
              Your Statistics
            </div>

            {isAuth ? (
              myStatsLoading ? (
                <PanelMessage>Loading your ranked stats...</PanelMessage>
              ) : (
                <>
                  <MetricRow
                    icon={statsIcon}
                    label="Rating"
                    value={myStats?.elo ?? 100}
                  />
                  <MetricRow
                    icon={trophyIcon}
                    label="Rank"
                    value={myStats ? `#${myStats.rank}` : "-"}
                  />
                  <MetricRow
                    icon={shieldIcon}
                    label="Record"
                    value={`${myStats?.wins ?? 0}-${myStats?.losses ?? 0}`}
                  />
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: 12,
                      color: "var(--color-ink-muted)",
                      fontSize: 13,
                    }}
                  >
                    {myStats?.totalGames ?? 0} games, {myStats?.winRate ?? 0}%
                    win rate
                  </div>
                </>
              )
            ) : (
              <div style={{ marginTop: 26 }}>
                <PanelMessage>
                  Sign in to track your rank, rating, and ranked record.
                </PanelMessage>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => navigate("/login")}
                  style={{ width: "100%", marginTop: 18 }}
                >
                  Sign In
                </Button>
              </div>
            )}
          </div>

          <div
            className="mp-surface mp-ranked-leaderboard"
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              background:
                "linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-sunk) 100%)",
              border: "1px solid var(--color-line)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--color-ink)",
                }}
              >
                Leaderboard
              </div>
              <span style={{ color: "var(--color-ink-faint)", fontSize: 12 }}>
                Top 10
              </span>
            </div>

            {leaderboardLoading ? (
              <PanelMessage>Loading leaderboard...</PanelMessage>
            ) : leaderboard.length === 0 ? (
              <PanelMessage>No ranked players yet.</PanelMessage>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {leaderboard.map((entry) => (
                  <button
                    key={entry.rank}
                    onClick={() => setSelectedPlayer(entry)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "46px 1fr 72px 72px",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid var(--color-line)",
                      borderRadius: 10,
                      background: "var(--color-paper)",
                      color: "var(--color-ink)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "var(--font-ui)",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>#{entry.rank}</span>
                    <span
                      style={{
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontWeight: 650,
                      }}
                    >
                      {entry.displayName}
                    </span>
                    <span
                      style={{
                        color: "var(--color-ink-muted)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {entry.elo}
                    </span>
                    <span
                      style={{
                        color: "var(--color-ink-muted)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {entry.wins}-{entry.losses}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className="mp-surface"
          style={{
            padding: 18,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            background:
              "linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-sunk) 100%)",
            border: "1px solid var(--color-line)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 750,
                color: "var(--color-ink)",
              }}
            >
              Board Size
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                color: "var(--color-ink-muted)",
              }}
            >
              Each size has its own queue. Elo remains shared.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {RANKED_BOARD_SIZES.map((size) => {
              const selected = selectedBoardSize === size;
              return (
                <button
                  key={size}
                  disabled={searching}
                  onClick={() => setSelectedBoardSize(size)}
                  style={{
                    minWidth: 76,
                    padding: "9px 12px",
                    border: selected
                      ? "1px solid var(--color-blue-500)"
                      : "1px solid var(--color-line)",
                    borderRadius: 10,
                    background: selected
                      ? "var(--color-blue-100)"
                      : "var(--color-paper)",
                    color: selected
                      ? "var(--color-blue-600)"
                      : "var(--color-ink)",
                    cursor: searching ? "not-allowed" : "pointer",
                    opacity: searching ? 0.65 : 1,
                    fontFamily: "var(--font-ui)",
                    fontSize: 14,
                    fontWeight: 750,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {size} × {size}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button
            variant="primary"
            size="md"
            onClick={startSearching}
            style={{
              width: "100%",
              fontSize: 19,
              fontWeight: 700,
            }}
          >
            Play {selectedBoardSize} × {selectedBoardSize}
          </Button>
        </div>

        {searching && (
          <QueueModal onCancel={cancelSearching}>
            <div
              style={{
                width: 40,
                height: 40,
                border: "4px solid var(--color-blue-100)",
                borderTop: "4px solid var(--color-blue-500)",
                borderRadius: "50%",
                margin: "0 auto 10px",
                animation: "spin 1s linear infinite",
              }}
            />
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "var(--color-ink)",
              }}
            >
              Please wait...
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 15,
                color: "var(--color-ink-muted)",
              }}
            >
              Finding matches
              <span style={{ display: "block", marginTop: 4 }}>
                {selectedBoardSize} × {selectedBoardSize}
              </span>
            </div>
          </QueueModal>
        )}

        {timedOut && (
          <QueueModal onCancel={cancelSearching}>
            <h2
              style={{
                margin: 0,
                fontSize: 24,
                color: "var(--color-ink-muted)",
                font: "var(--font-heading)",
                fontWeight: 700,
              }}
            >
              No match found
            </h2>
            <p style={{ marginTop: 12, color: "var(--color-ink-muted)" }}>
              {queueMessage}
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 14,
                marginTop: 28,
              }}
            >
              <Button
                variant="ghost"
                onClick={
                  requiresLogin ? () => navigate("/login") : keepSearching
                }
                style={{ fontSize: 16, fontWeight: 620 }}
              >
                {requiresLogin ? "Login/Sign Up" : "Keep Searching"}
              </Button>
            </div>
          </QueueModal>
        )}

        {selectedPlayer && (
          <PlayerStatsDialog
            player={selectedPlayer}
            onClose={() => setSelectedPlayer(null)}
          />
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
}

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", paddingTop: 6 }}>
      <img
        src={icon}
        alt=""
        style={{ width: 40, height: 40, opacity: 0.8, marginTop: 8 }}
        className="icons"
      />

      <div
        style={{
          padding: 20,
          display: "flex",
          flexDirection: "column",
          color: "var(--color-ink-faint)",
        }}
      >
        <p style={{ marginLeft: 4 }}>{label}</p>
        <p style={{ marginTop: 4, fontSize: 40, fontWeight: 700 }}>{value}</p>
      </div>
    </div>
  );
}

function PanelMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        margin: "auto 0",
        minHeight: 150,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        color: "var(--color-ink-muted)",
        fontWeight: 650,
      }}
    >
      {children}
    </div>
  );
}

function QueueModal({
  children,
  onCancel,
}: {
  children: React.ReactNode;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--color-surface)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 250,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          minHeight: 200,
          padding: 32,
          background: "var(--color-paper)",
          borderRadius: 20,
          boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
          textAlign: "center",
        }}
      >
        <button
          onClick={onCancel}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            border: "none",
            borderRadius: 8,
            background: "transparent",
            color: "var(--color-ink)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="x" size={18} color="var(--color-ink)" />
        </button>
        {children}
      </div>
    </div>
  );
}

function PlayerStatsDialog({
  player,
  onClose,
}: {
  player: RankedStats;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
        padding: 24,
      }}
    >
      <div
        className="mp-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ranked-player-stats-title"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: 420, width: "100%", padding: 26 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              id="ranked-player-stats-title"
              style={{
                fontSize: 22,
                fontWeight: 750,
                color: "var(--color-ink)",
              }}
            >
              {player.displayName}
            </div>
            <div style={{ color: "var(--color-ink-muted)", marginTop: 4 }}>
              Rank #{player.rank}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close player stats"
            style={{
              width: 34,
              height: 34,
              border: "1px solid var(--color-line)",
              borderRadius: 8,
              background: "var(--color-paper)",
              color: "var(--color-ink)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <ProfileStat label="Rating" value={player.elo} />
          <ProfileStat label="Win Rate" value={`${player.winRate}%`} />
          <ProfileStat label="Wins" value={player.wins} />
          <ProfileStat label="Losses" value={player.losses} />
          <ProfileStat label="Games" value={player.totalGames} />
          <ProfileStat
            label="Record"
            value={`${player.wins}-${player.losses}`}
          />
        </div>
      </div>
    </div>
  );
}

function ProfileStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        padding: 14,
        border: "1px solid var(--color-line)",
        borderRadius: 10,
        background: "var(--color-paper)",
      }}
    >
      <div style={{ color: "var(--color-ink-muted)", fontSize: 12 }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 22,
          fontWeight: 750,
          color: "var(--color-ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
