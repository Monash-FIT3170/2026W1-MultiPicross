import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  HANDLE_MAX,
  HANDLE_MIN,
  HANDLE_PATTERN,
  HANDLE_RULE,
  handleInputCls,
  handleLabelCls,
} from "../auth/handle";
import "./PagePlaceholder.css";

function HandleSetting() {
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
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <label className={handleLabelCls} htmlFor="handle">
        Handle
      </label>
      <div className="flex gap-2">
        <input
          id="handle"
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
          className={handleInputCls}
        />
        <button
          type="submit"
          disabled={loading || value === user?.handle}
          className="rounded-xl bg-gray-900 px-4 py-2 font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Handle updated.</p>}
    </form>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const { status, user } = useAuth();

  return (
    <div className="page-placeholder">
      <h1>Settings</h1>
      <p>Audio, display, and control settings.</p>

      {status === "authenticated" && user && <HandleSetting />}

      <button
        className="rounded-xl bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-black"
        onClick={() => navigate("/")}
      >
        Main Menu
      </button>
    </div>
  );
}
