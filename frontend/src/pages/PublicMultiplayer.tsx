import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo, Icon, BackButton, Button } from "../components/ui";
import { useAuth } from "../auth/AuthContext";

const PUBLIC_ROOMS_POLL_MS = 5000;
const GS_BASE = `${window.location.protocol}//${window.location.host}/gs`;

interface PublicRoom {
  roomId: string;
  width: number;
  height: number;
  clients: number;
  maxClients: number;
}

export function PublicMultiplayer() {
  const navigate = useNavigate();
  const { playerName } = useAuth();
  const [publicRooms, setPublicRooms] = useState<PublicRoom[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPublicRooms() {
      try {
        const res = await fetch(`${GS_BASE}/public-rooms`);
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
          Public Multiplayer
        </h1>
        <p
          style={{
            margin: "0 0 28px",
            color: "var(--color-ink-muted)",
            marginTop: 10,
            fontSize: 18,
          }}
        >
          1v1 head-to-head with your friends. First to fill every cell wins.
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
