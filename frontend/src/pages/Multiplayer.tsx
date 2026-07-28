import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo, Icon, BackButton, Chip, Button } from "../components/ui";

const SIZES = ["5 × 5", "10 × 10", "15 × 15", "20 × 20"] as const;

export function Multiplayer() {
  const navigate = useNavigate();
  const [createSize, setCreateSize] = useState<string>("10 × 10");
  const [inviteCode, setInviteCode] = useState("");

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
        <BackButton onClick={() => navigate("/")} label="Main menu" />
        <Logo size={22} />
        <div style={{ width: 100 }} />
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1
          style={{
            margin: "0 0 4px",
            fontSize: 30,
            fontWeight: 700,
            color: "var(--color-ink)",
          }}
        >
          Multiplayer
        </h1>
        <p
          style={{
            margin: "0 0 28px",
            color: "var(--color-ink-muted)",
            fontSize: 15,
          }}
        >
          1v1 head-to-head. First to fill every cell wins.
        </p>

        {/* Quick actions */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
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
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--color-ink)",
                }}
              >
                Create lobby
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="mp-eyebrow">Size</span>
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
                      fontSize: 12,
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
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate("/multiplayer-game")}
            >
              Create
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
                  fontSize: 15,
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
                fontSize: 14,
                fontFamily: "var(--font-ui)",
                background: "#fff",
                color: "var(--color-ink)",
                outline: "none",
                textAlign: "center",
                letterSpacing: "0.2em",
              }}
            />
            <Button variant="primary" size="md" disabled>
              Join
            </Button>
          </div>

          {/* Quick match */}
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
                color="var(--color-sage-50)"
                iconColor="var(--color-sage-500)"
                icon="trophy"
              />
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--color-ink)",
                }}
              >
                Quick match
              </div>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--color-ink-muted)",
              }}
            >
              Pair me with the next available player.
            </p>
            <Chip tone="sage" style={{ alignSelf: "flex-start" }}>
              ~30s wait
            </Chip>
            <Button variant="primary" size="md" disabled>
              Match me
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
            No open games right now.
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
