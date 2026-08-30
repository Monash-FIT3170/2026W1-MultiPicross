import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo, Icon, BackButton, Button } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { GAMESERVER_BASE_URL } from "../colyseus";

const SIZES = ["5 × 5", "10 × 10", "15 × 15", "20 × 20"] as const;
const PUBLIC_ROOMS_POLL_MS = 5000;

function sizeToWH(size: string): { width: number; height: number } {
  const [w, h] = size.split(" × ").map(Number);
  return { width: w, height: h };
}

// Reads an error message off a failed gameserver response. Not every body is
// JSON — Traefik answers the rate limit with plain text — so res.json() would
// surface a raw SyntaxError to the player.
async function readError(res: Response, fallback: string): Promise<string> {
  if (res.status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  try {
    const body = (await res.json()) as { error?: string };
    if (typeof body.error === "string") return body.error;
  } catch {
    // Body was not JSON, use the caller's fallback.
  }
  return fallback;
}

// A 200 with an unexpected body would otherwise surface a raw SyntaxError.
async function readRoomId(res: Response, fallback: string): Promise<string> {
  try {
    const { roomId } = (await res.json()) as { roomId?: string };
    if (typeof roomId === "string" && roomId.length > 0) return roomId;
  } catch {
    // Fall through to the caller's fallback.
  }
  throw new Error(fallback);
}

interface PublicRoom {
  roomId: string;
  width: number;
  height: number;
  clients: number;
  maxClients: number;
}

export function UnratedMultiplayer() {
  const navigate = useNavigate();
  const { playerName } = useAuth();

  const [createSize, setCreateSize] = useState<string>("10 × 10");
  const [isPublicCreate, setIsPublicCreate] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPublicRooms() {
      try {
        const res = await fetch(`${GAMESERVER_BASE_URL}/public-rooms`);
        if (!res.ok) return;
        const rooms = (await res.json()) as PublicRoom[];
        if (!cancelled) setPublicRooms(rooms);
      } catch {
        // Keep the last known list on transient network errors.
      }
    }

    void fetchPublicRooms();
    const interval = setInterval(
      () => void fetchPublicRooms(),
      PUBLIC_ROOMS_POLL_MS,
    );
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function handleCreate() {
    setCreateLoading(true);
    setCreateError(null);
    try {
      const { width, height } = sizeToWH(createSize);
      const res = await fetch(
        `${GAMESERVER_BASE_URL}/create-room?width=${width}&height=${height}&public=${isPublicCreate}`,
        { method: "POST" },
      );
      if (!res.ok) {
        throw new Error(await readError(res, "Failed to create room"));
      }
      const roomId = await readRoomId(res, "Failed to create room");
      navigate(`/room/${roomId}`);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create room",
      );
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleJoin() {
    if (!inviteCode.trim()) return;
    setJoinLoading(true);
    setJoinError(null);
    try {
      const res = await fetch(
        `${GAMESERVER_BASE_URL}/room-by-code/${inviteCode.trim()}`,
      );
      if (!res.ok) {
        throw new Error(await readError(res, "Room not found"));
      }
      const roomId = await readRoomId(res, "Room not found");
      navigate(`/room/${roomId}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Room not found");
    } finally {
      setJoinLoading(false);
    }
  }

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
        }}
      >
        <BackButton onClick={() => navigate("/")} label="Main Menu" />
        <Logo size={34} />
        <div style={{ width: 100 }} />
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1
          style={{
            margin: "0 0 4px",
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "var(--color-ink)",
          }}
        >
          Unrated Multiplayer
        </h1>
        <p
          style={{
            margin: "0 0 28px",
            color: "var(--color-ink-muted)",
            marginTop: 10,
            fontSize: 18,
          }}
        >
          1v1 head-to-head. First to fill every cell wins.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 24,
            fontSize: 13,
            color: "var(--color-ink-muted)",
          }}
        >
          <Icon name="user" size={14} color="var(--color-ink-faint)" />
          <span>
            Playing as{" "}
            <strong style={{ color: "var(--color-ink)" }}>{playerName}</strong>
          </span>
        </div>

        {/* Options */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 40,
          }}
        >
          {/* Create lobby */}
          <div
            className="mp-surface"
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IconBadge
                color="var(--color-blue-50)"
                iconColor="var(--color-blue-500)"
                icon="plus"
              />
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--color-ink)",
                }}
              >
                Create lobby
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                className="mp-eyebrow"
                style={{
                  fontSize: 14,
                }}
              >
                Size
              </span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setCreateSize(s)}
                    style={{
                      padding: "4px 10px",
                      background:
                        createSize === s ? "var(--color-blue-500)" : "#fff",
                      color:
                        createSize === s ? "#fff" : "var(--color-ink-soft)",
                      border: `1px solid ${createSize === s ? "var(--color-blue-500)" : "var(--color-line)"}`,
                      borderRadius: 999,
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "var(--font-ui)",
                      transition: "background 120ms ease, color 120ms ease",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--color-ink-soft)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={isPublicCreate}
                onChange={(e) => setIsPublicCreate(e.target.checked)}
              />
              Public — anyone can find and join
            </label>
            {createError && (
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "var(--color-coral-500)",
                }}
              >
                {createError}
              </p>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={() => void handleCreate()}
              disabled={createLoading}
              style={{
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {createLoading ? "Creating…" : "Create"}
            </Button>
          </div>

          {/* Join with code */}
          <div
            className="mp-surface"
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IconBadge
                color="var(--color-butter-50)"
                iconColor="#8a7338"
                icon="key"
              />
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--color-ink)",
                }}
              >
                Join with code
              </div>
            </div>
            <input
              type="text"
              placeholder="ENTER CODE"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={6}
              style={{
                padding: "10px 14px",
                border: "1px solid var(--color-line)",
                borderRadius: 10,
                fontSize: 16,
                fontFamily: "var(--font-ui)",
                background: "#fff",
                color: "var(--color-ink)",
                outline: "none",
                textAlign: "center",
                letterSpacing: "0.2em",
                // Auto margins above and below split the card's spare height, centring the
                // input and leaving the button on the bottom edge, level with Create.
                marginTop: "auto",
                marginBottom: "auto",
              }}
            />
            {joinError && (
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "var(--color-coral-500)",
                }}
              >
                {joinError}
              </p>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={() => void handleJoin()}
              disabled={joinLoading || !inviteCode.trim()}
              style={{
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {joinLoading ? "Joining…" : "Join"}
            </Button>
          </div>
        </div>
        {/* Public games */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              color: "var(--color-ink)",
            }}
          >
            Public games
          </h2>
        </div>

        {publicRooms === null || publicRooms.length === 0 ? (
          <div
            className="mp-surface"
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--color-ink-muted)",
            }}
          >
            <Icon
              name="users"
              size={32}
              color="var(--color-line-strong)"
              style={{
                marginBottom: 12,
                display: "block",
                margin: "0 auto 12px",
              }}
            />
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {publicRooms === null
                ? "Loading public games…"
                : "No open games right now."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {publicRooms.map((room) => (
              <div
                key={room.roomId}
                className="mp-surface"
                style={{
                  padding: "14px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <IconBadge
                    color="var(--color-sage-50)"
                    iconColor="var(--color-sage-500)"
                    icon="users"
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--color-ink)",
                      }}
                    >
                      {room.width} × {room.height}
                    </div>
                    <div
                      style={{ fontSize: 12, color: "var(--color-ink-muted)" }}
                    >
                      {room.clients}/{room.maxClients} · waiting for opponent
                    </div>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate(`/room/${room.roomId}`)}
                >
                  Join
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
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
