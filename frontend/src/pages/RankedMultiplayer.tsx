import { useNavigate } from "react-router-dom";
import { BackButton, Button, Logo, Icon } from "../components/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "@colyseus/sdk";
import { gameserverClient } from "../colyseus";
import { apiFetch } from "../api/client";
import { useElo } from "../api/elo";
import statsIcon from "../assets/stats.svg";
import trohpyIcon from "../assets/trophy.svg";
import shieldIcon from "../assets/shield.svg";

export function RankedMultiplayer() {
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const queueRoomRef = useRef<Room | null>(null);
  const { playerElo } = useElo(true);

  const leaveQueueRoom = useCallback(() => {
    const room = queueRoomRef.current;
    if (!room) return;

    queueRoomRef.current = null;
    room.send("leaveQueue");
    void room.leave();
  }, []);

  useEffect(() => leaveQueueRoom, [leaveQueueRoom]);

  const startSearching = async () => {
    // Already queued, so the timers and handlers below are already running.
    if (queueRoomRef.current) return;

    setSearching(true);
    setTimedOut(false);

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

      room.onMessage("matched", ({ roomId }: { roomId: string }) => {
        // Cleared first so unmounting does not send leaveQueue for a player
        // who has already been matched out of the waiting list.
        queueRoomRef.current = null;
        setSearching(false);
        setTimedOut(false);
        void room.leave();
        navigate(`/room/${roomId}`);
      });

      // The server keeps us queued past the timeout, so this asks whether to
      // keep waiting rather than reporting that the search has stopped.
      room.onMessage("queueTimeoutEmpty", () => {
        setSearching(false);
        setTimedOut(true);
      });

      room.onLeave(() => {
        if (queueRoomRef.current === room) queueRoomRef.current = null;
      });

      room.send("joinQueue");
    } catch (error) {
      console.error("Failed to join ranked matchmaking:", error);
      queueRoomRef.current = null;
      setSearching(false);
      setTimedOut(true);
    }
  };

  const keepSearching = () => {
    const room = queueRoomRef.current;

    // Still connected and still queued, so ask for another wait rather than
    // tearing the room down and rejoining.
    if (!room) {
      void startSearching();
      return;
    }

    setSearching(true);
    setTimedOut(false);
    room.send("stayInQueue");
  };

  const cancelSearching = () => {
    leaveQueueRoom();
    setSearching(false);
    setTimedOut(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-paper)",
        padding: "24px",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "relative",
          }}
        >
          <BackButton onClick={() => navigate("/")} label="Main Menu" />
        </div>

        <Logo size={34} />

        <div style={{ width: 100 }} />
      </div>

      {/* Body */}
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
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2fr",
            gap: 16,
            marginBottom: 40,
          }}
        >
          {/* Your Stats - Left column  */}
          <div
            className="mp-surface"
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              background: "linear-gradient(135deg, #EAF3FF 0%, #F7FBFF 100%)",
              border: "1px solid #D6E6FF",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--color-ink)",
                }}
              >
                Your Statistics
              </div>
            </div>

            {/* Rating */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                paddingTop: 6,
              }}
            >
              <img
                src={statsIcon}
                alt=""
                style={{ width: 40, height: 40, opacity: 0.8, marginTop: 8 }}
              />

              <div
                style={{
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <p
                  style={{
                    marginLeft: 4,
                  }}
                >
                  Rating
                </p>

                <p
                  style={{
                    marginTop: 4,
                    fontSize: 40,
                    fontWeight: 700,
                  }}
                >
                  {playerElo ?? 100}
                </p>
              </div>
            </div>

            {/* Wins */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                paddingTop: 6,
              }}
            >
              <img
                src={trohpyIcon}
                alt=""
                style={{ width: 40, height: 40, opacity: 0.8, marginTop: 8 }}
              />

              <div
                style={{
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <p
                  style={{
                    marginLeft: 4,
                  }}
                >
                  Wins
                </p>

                <p
                  style={{
                    marginTop: 4,
                    fontSize: 40,
                    fontWeight: 700,
                  }}
                >
                  54
                </p>
              </div>
            </div>

            {/* Losses */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                paddingTop: 6,
              }}
            >
              <img
                src={shieldIcon}
                alt=""
                style={{ width: 40, height: 40, opacity: 0.8, marginTop: 8 }}
              />

              <div
                style={{
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <p
                  style={{
                    marginLeft: 4,
                  }}
                >
                  Losses
                </p>

                <p
                  style={{
                    marginTop: 4,
                    fontSize: 40,
                    fontWeight: 700,
                  }}
                >
                  54
                </p>
              </div>
            </div>
          </div>

          {/* Leaderboard - Right column */}
          <div
            className="mp-surface"
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Leaderboard Heading */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--color-ink)",
                }}
              >
                Leaderboard
              </div>
            </div>

            {/* Not Implemented Leaderboard */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                paddingTop: 6,
              }}
            >
              <div
                style={{
                  marginTop: 100,
                  marginLeft: 210,
                  alignItems: "center",
                  flexDirection: "column",
                  fontWeight: 700,
                  fontSize: 20,
                  color: "var(--color-ink-muted)",
                }}
              >
                Not Implemented
              </div>
            </div>
          </div>
        </div>

        {/* Play Game Button */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
          }}
        >
          {" "}
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
            Play Game
          </Button>
        </div>

        {/* Searching Modal */}
        {searching && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "relative",
                width: 420,
                height: 200,
                padding: 32,
                background: "var(--color-paper)",
                borderRadius: 20,
                boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
                textAlign: "center",
              }}
            >
              {/* Cancel button */}
              <div
                onClick={cancelSearching}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  width: 32,
                  height: 32,
                  border: "none",
                  borderRadius: 8,
                  background: "#F3F4F6",
                  color: "#000",
                  fontSize: 20,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s ease",
                }}
              >
                <IconBadge iconColor="#000" icon="x" color={""} />
              </div>

              {/* Loading spinner */}
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

              {/* Loading spinner */}
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--color-ink)",
                }}
              >
                Please wait...
              </div>

              {/* Finding matches */}
              <div
                style={{
                  marginTop: 8,
                  fontSize: 15,
                  color: "var(--color-ink-muted)",
                }}
              >
                Finding matches
              </div>
            </div>
          </div>
        )}

        {/* No Match Modal */}
        {timedOut && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.25)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div
              style={{
                position: "relative",
                width: 420,
                height: 200,
                padding: 32,
                background: "var(--color-paper)",
                borderRadius: 20,
                textAlign: "center",
                boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
              }}
            >
              {/* Cancel button */}
              <div
                onClick={cancelSearching}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  width: 32,
                  height: 32,
                  border: "none",
                  borderRadius: 8,
                  background: "#F3F4F6",
                  color: "#000",
                  fontSize: 20,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s ease",
                }}
              >
                <IconBadge iconColor="#000" icon="x" color={""} />
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: 24,
                }}
              >
                No match found
              </h2>

              <p
                style={{
                  marginTop: 12,
                  color: "var(--color-ink-muted)",
                }}
              >
                We've been unable to find an opponent.
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
                  onClick={keepSearching}
                  style={{
                    fontSize: 16,
                    fontWeight: 620,
                  }}
                >
                  Keep Searching
                </Button>

                {/*    <Button onClick={simulateMatchFound}>
                    Simulate Match
                </Button> */}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spinner animation */}
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

function IconBadge({
  color,
  iconColor,
  icon,
}: {
  color: string;
  iconColor: string;
  icon: import("../components/ui").IconName;
}) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={18} color={iconColor} />
    </div>
  );
}
