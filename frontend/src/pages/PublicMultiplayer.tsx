import { useNavigate } from "react-router-dom";
import { Logo, Icon, BackButton } from "../components/ui";
import { useAuth } from "../auth/AuthContext";

export function PublicMultiplayer() {
  const navigate = useNavigate();
  const { playerName } = useAuth();

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
            <strong style={{ color: "var(--color-ink)" }}>
              {playerName}
            </strong>
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
