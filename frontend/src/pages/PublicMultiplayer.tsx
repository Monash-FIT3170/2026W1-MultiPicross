import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo, Icon, BackButton, Chip, Button } from "../components/ui";

const SIZES = ["5 × 5", "10 × 10", "15 × 15", "20 × 20"] as const;

export function PublicMultiplayer() {
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
