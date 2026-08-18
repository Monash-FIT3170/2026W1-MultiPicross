import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { BackButton, Logo } from "../components/ui";

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
          className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white px-8 py-10 shadow-lg"
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
              className="text-center text-lg font-semibold text-gray-800"
              style={{
                margin: 0,
                letterSpacing: "0",
                lineHeight: 1.3,
              }}
            >
              Guest Mode
            </h1>

            <p
              className="text-center text-sm text-gray-500"
              style={{
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Choose a nickname to continue.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="nickname"
              className="text-sm font-medium text-gray-700"
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
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-[var(--color-accent-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)]/20"
            />

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <button
            type="submit"
            className="rounded-xl bg-gray-900 py-2 font-semibold text-white transition hover:bg-black"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
