import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { BackButton, Logo } from "../components/ui";

export function GuestNickname() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setGuestNickname } = useAuth();

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? "/";

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
    navigate(from, { replace: true });
  }

  return (
    <div
      className="mp-page mp-guest-page"
      style={{
        minHeight: "100vh",
        background: "var(--color-paper)",
        padding: 24,
      }}
    >
      {/* Top bar */}
      <div
        className="mp-topbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
        }}
      >
        <BackButton onClick={() => navigate("/")} label="Main menu" />

        <Logo size={22} />

        {/* Keeps the logo centred */}
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
          noValidate
          className="mp-auth-form flex w-full max-w-sm flex-col gap-4 rounded-2xl px-8 py-10 shadow-lg"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-line)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <h1
              className="text-center text-lg font-semibold"
              style={{
                margin: 0,
                letterSpacing: "0",
                lineHeight: 1.3,
                color: "var(--color-ink)",
              }}
            >
              Guest Mode
            </h1>

            <p
              className="text-center text-sm"
              style={{
                margin: 0,
                lineHeight: 1.5,
                color: "var(--color-ink-muted)",
              }}
            >
              Choose a nickname to continue.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="nickname"
              className="text-sm font-medium"
              style={{ color: "var(--color-ink)" }}
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
              className="rounded-xl border px-4 py-2 text-sm outline-none focus:border-[var(--color-accent-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)]/20"
              style={{
                background: "var(--color-surface)",
                color: "var(--color-ink)",
                borderColor: "var(--color-line-strong)",
              }}
            />

            {error && (
              <p
                className="text-xs"
                style={{ color: "var(--color-accent-error)" }}
              >
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="rounded-xl py-2 font-semibold transition"
            style={{
              background: "var(--color-blue-500)",
              color: "var(--color-surface)",
            }}
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
