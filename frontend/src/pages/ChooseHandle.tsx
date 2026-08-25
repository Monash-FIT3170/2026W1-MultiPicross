import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  HANDLE_MAX,
  HANDLE_MIN,
  HANDLE_PATTERN,
  HANDLE_RULE,
  handleInputCls,
  handleLabelCls,
} from "../auth/handle";

export function ChooseHandle() {
  const { status, user, setHandle } = useAuth();
  const navigate = useNavigate();

  const [handle, setHandleInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Checking session…
      </div>
    );
  }
  if (status !== "authenticated" || !user) {
    return <Navigate to="/login" replace />;
  }
  if (user.handle !== null) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!HANDLE_PATTERN.test(handle)) {
      setError(HANDLE_RULE);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await setHandle(handle);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-lg">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4 px-8 py-10"
        >
          <h2 className="text-center text-lg font-semibold text-gray-800">
            Choose a handle
          </h2>
          <p className="text-center text-sm text-gray-500">
            This is how other players will see you. You can change it later in
            Settings.
          </p>

          <div className="flex flex-col gap-1">
            <label className={handleLabelCls} htmlFor="handle">
              Handle
            </label>
            <input
              id="handle"
              type="text"
              autoComplete="off"
              required
              minLength={HANDLE_MIN}
              maxLength={HANDLE_MAX}
              value={handle}
              onChange={(e) => {
                setHandleInput(e.target.value);
                setError(null);
              }}
              className={handleInputCls}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-gray-900 py-2 font-semibold text-white transition hover:bg-black disabled:opacity-60"
          >
            {loading ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
