import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  HANDLE_MAX,
  HANDLE_MIN,
  HANDLE_PATTERN,
  HANDLE_RULE,
} from "../../auth/handle";
import { useSettings } from "./SettingsContext";
import plusIcon from "../../assets/settings/plus.svg";
import profileIcon from "../../assets/settings/profile.svg";

const accentOptions = [
  "#3D5A80",
  "#9284C6",
  "#4CAF83",
  "#E47D60",
  "#DCBA70",
  "#222225",
];

export function ProfileSettings() {
  const navigate = useNavigate();
  const { status, user, setHandle } = useAuth();
  const { profileAccent, setProfileAccent, closeSettings } = useSettings();

  const [value, setValue] = useState(user?.handle ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSignIn() {
    closeSettings();
    navigate("/login");
  }

  if (status !== "authenticated" || !user) {
    return (
      <div>
        <h2 className="text-xl font-bold text-[var(--color-ink)] font-ui">
          Profile
        </h2>

        <p className="mt-1 text-[14px] text-[var(--color-ink-muted)] font-ui">
          Manage your player profile and identity.
        </p>

        <div
          className="
            mt-8 flex flex-col items-center justify-center
            rounded-2xl
            border-2 border-[var(--color-line)]
            bg-[var(--color-surface-sunk)]
            px-8 py-12
            text-center
          "
        >
          <div
            className="
              flex h-11 w-11 items-center justify-center
              rounded-full
              border-2 border-[var(--color-line-strong)]
            "
          >
            <img
              src={profileIcon}
              alt=""
              aria-hidden="true"
              className="settings-icon h-5 w-5 opacity-60"
            />
          </div>

          <h3 className="mt-4 text-base text-[16px] font-bold text-[var(--color-ink)] font-ui">
            You're playing as a guest
          </h3>

          <p className="mt-2 max-w-md text-[14px] text-[var(--color-ink-muted)] font-ui">
            Sign in to pick a handle, set a nickname, and keep your settings
            across devices.
          </p>

          <button
            type="button"
            onClick={handleSignIn}
            className="
              mt-6 min-h-11 rounded-xl
              bg-[var(--color-blue-500)]
              px-6
              text-sm font-semibold
              text-white font-ui
              transition
              hover:opacity-90
            "
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!HANDLE_PATTERN.test(value)) {
      setError(HANDLE_RULE);
      return;
    }

    setError(null);
    setSaved(false);
    setLoading(true);

    try {
      await setHandle(value);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-ink)] font-ui">
        Profile
      </h2>

      <p className="mt-1 text-[14px] text-[var(--color-ink-muted)] font-ui">
        Your handle is unique. Your nickname is what other players see.
      </p>

      {/* Profile accent */}
      <div className="mt-6 flex items-center gap-3">
        <div
          className="
            flex h-12 w-12 shrink-0 items-center justify-center
            rounded-full text-sm font-bold text-white font-ui
          "
          style={{ backgroundColor: profileAccent }}
        >
          {user?.handle?.slice(0, 2).toUpperCase() ?? "?"}
        </div>

        <div>
          <p
            className="
              pl-[10px]
              text-xs font-medium uppercase tracking-wider
              text-[var(--color-ink-faint)] font-ui
            "
          >
            Accent
          </p>

          <div className="mt-1 flex items-center -space-x-2">
            {accentOptions.map((color) => {
              const selected =
                profileAccent.toLowerCase() === color.toLowerCase();

              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => setProfileAccent(color)}
                  aria-label={`Select ${color} profile accent`}
                  aria-pressed={selected}
                  className="
                    flex h-11 w-11 items-center justify-center
                    rounded-full
                  "
                >
                  <span
                    className={`
                      h-6 w-6 rounded-full
                      ${
                        selected
                          ? "ring-2 ring-[var(--color-blue-500)] ring-offset-2 ring-offset-[var(--color-surface)]"
                          : ""
                      }
                    `}
                    style={{ backgroundColor: color }}
                  />
                </button>
              );
            })}

            {/* Custom colour */}
            <label
              className="
                relative flex h-11 w-11 cursor-pointer
                items-center justify-center rounded-full
              "
              aria-label="Choose custom profile accent colour"
            >
              <span
                className="
                  flex h-6 w-6 items-center justify-center
                  rounded-full
                  border border-[var(--color-line-strong)]
                "
              >
                <img
                  src={plusIcon}
                  alt=""
                  aria-hidden="true"
                  className="settings-icon h-2.5 w-2.5"
                />
              </span>

              <input
                type="color"
                value={profileAccent}
                onChange={(e) => setProfileAccent(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Custom profile accent colour"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Handle */}
      <form onSubmit={onSubmit} noValidate className="mt-6">
        <label
          htmlFor="profile-handle"
          className="text-sm font-medium text-[var(--color-ink)] font-ui"
        >
          Handle
        </label>

        <div className="mt-2 flex gap-3">
          <div
            className="
              flex min-h-11 flex-1 items-center
              rounded-xl border border-[var(--color-line)]
              bg-[var(--color-surface)]
              px-3
              focus-within:border-[var(--color-blue-500)]
            "
          >
            <span
              className="mr-2 text-[var(--color-ink-faint)]"
              aria-hidden="true"
            >
              @
            </span>

            <input
              id="profile-handle"
              type="text"
              autoComplete="off"
              required
              minLength={HANDLE_MIN}
              maxLength={HANDLE_MAX}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
                setSaved(false);
              }}
              className="
                w-full bg-transparent
                text-sm text-[var(--color-ink)]
                outline-none font-ui
              "
            />
          </div>

          <button
            type="submit"
            disabled={loading || value === user?.handle}
            className="
              min-h-11 rounded-xl
              bg-[var(--color-blue-500)]
              px-4
              text-sm font-semibold
              text-white font-ui
              transition
              hover:opacity-90
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {loading ? "Saving…" : "Save"}
          </button>
        </div>

        <p className="mt-2 text-xs text-[var(--color-ink-faint)] font-ui">
          Letters, numbers and underscores. {HANDLE_MIN}–{HANDLE_MAX}{" "}
          characters.
        </p>

        {error && (
          <p className="mt-2 text-[13px] text-[var(--color-accent-error)] font-ui">
            {error}
          </p>
        )}

        {saved && (
          <p className="mt-2 text-sm text-green-700 font-ui">Handle updated.</p>
        )}
      </form>
    </div>
  );
}
