import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { BackButton, Button, Logo } from "../components/ui";

export function GuestNickname() {
  const navigate = useNavigate();
  const { setGuestNickname } = useAuth();

  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedNickname = nickname.trim();

    if (!trimmedNickname) {
      setError("Enter a nickname");
      return;
    }

    setGuestNickname(trimmedNickname);
    navigate("/multiplayer", { replace: true });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-paper)",
        padding: 24,
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

        {/* Keeps the logo visually centred */}
        <div style={{ width: 100 }} />
      </div>

      {/* Main content */}
      <div
        style={{
          minHeight: "calc(100vh - 100px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: 80,
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="mp-surface"
          style={{
            width: "100%",
            maxWidth: 380,
            padding: 32,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                margin: "0 0 6px",
                textAlign: "center",
                fontSize: 26,
                fontWeight: 700,
                color: "var(--color-ink)",
              }}
            >
              Choose a nickname
            </h1>

            <p
              style={{
                margin: 0,
                textAlign: "center",
                fontSize: 14,
                color: "var(--color-ink-muted)",
              }}
            >
              This is how other players will see you.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <label
              htmlFor="nickname"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-ink-soft)",
              }}
            >
              Nickname
            </label>

            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
                setError(null);
              }}
              maxLength={20}
              autoFocus
              placeholder="Enter nickname"
              style={{
                padding: "10px 14px",
                border: `1px solid ${
                  error
                    ? "var(--color-coral-400)"
                    : "var(--color-line)"
                }`,
                borderRadius: 10,
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                color: "var(--color-ink)",
                background: "#fff",
                outline: "none",
              }}
            />

            {error && (
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "var(--color-coral-500)",
                }}
              >
                {error}
              </p>
            )}
          </div>

          <Button type="submit" variant="primary" size="md">
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}