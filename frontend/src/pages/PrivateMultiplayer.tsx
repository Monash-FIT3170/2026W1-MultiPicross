import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo, Icon, BackButton, Button } from "../components/ui";

const SIZES = ["5 × 5", "10 × 10", "15 × 15", "20 × 20"] as const;

function sizeToWH(size: string): { width: number; height: number } {
  const [w, h] = size.split(" × ").map(Number);
  return { width: w, height: h };
}

const GS_BASE = `${window.location.protocol}//${window.location.host}/gs`;

export function PrivateMultiplayer() {
  const navigate = useNavigate();
  const [createSize, setCreateSize] = useState<string>("10 × 10");
  const [isPublicCreate, setIsPublicCreate] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleCreate() {
    setCreateLoading(true);
    setCreateError(null);
    try {
      const { width, height } = sizeToWH(createSize);
      const res = await fetch(
        `${GS_BASE}/create-room?width=${width}&height=${height}&public=${isPublicCreate}`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to create room");
      }
      const { roomId } = (await res.json()) as { roomId: string };
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
      const res = await fetch(`${GS_BASE}/room-by-code/${inviteCode.trim()}`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Room not found");
      }
      const { roomId } = (await res.json()) as { roomId: string };
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
          Private Multiplayer
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
                marginTop: 10,
                paddingTop: 12,
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
                marginTop: 8,
              }}
            >
              {joinLoading ? "Joining…" : "Join"}
            </Button>
          </div>
        </div>
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
