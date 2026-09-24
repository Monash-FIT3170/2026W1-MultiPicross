import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
  HANDLE_MAX,
  HANDLE_MIN,
  HANDLE_PATTERN,
  HANDLE_RULE,
} from "../../auth/handle";

export function ProfileSettings() {
  const { user, setHandle } = useAuth();

  const [value, setValue] = useState(user?.handle ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

      <form onSubmit={onSubmit} noValidate className="mt-8">
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
          Letters, numbers and underscores. {HANDLE_MIN}–{HANDLE_MAX} characters.
        </p>

        {error && (
          <p className="mt-2 text-sm text-[var(--color-accent-error)] font-ui">
            {error}
          </p>
        )}

        {saved && (
          <p className="mt-2 text-sm text-green-700 font-ui">
            Handle updated.
          </p>
        )}
      </form>
    </div>
  );
}