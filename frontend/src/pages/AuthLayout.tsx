import { useEffect, useLayoutEffect, useRef, useState, type SubmitEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { animate } from "animejs";
import { useAuth } from "../auth/AuthContext";

const PAGE_TITLES: Record<string, string> = {
  "/login": "Sign in",
  "/register": "Create account",
};

const inputCls =
  "rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-[var(--color-accent-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)]/20";
const labelCls = "text-sm font-medium text-gray-700";

// gap-4 = 1rem = 16px — used to collapse the confirm-password top margin only.
// We do NOT cancel the bottom gap so the button always has consistent spacing above it.
const GAP = 16;

type FieldErrors = {
  username?: string;
  password?: string;
  confirmPassword?: string;
};

function useFadeIn(
  ref: React.RefObject<HTMLElement | null>,
  dep: unknown,
  options: { duration?: number; delay?: number } = {},
) {
  useLayoutEffect(() => {
    if (ref.current) ref.current.style.opacity = "0";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = animate(el, {
      opacity: [0, 1],
      duration: options.duration ?? 200,
      ease: "outCubic",
      delay: options.delay ?? 0,
    });
    return () => { anim.cancel(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}

// Fades in on mount. Use `key={message}` at the call site so re-mounting
// replays the animation when the message changes.
function FieldError({ message }: { message: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.style.opacity = "0";
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = animate(el, { opacity: [0, 1], duration: 150, ease: "outCubic" });
    return () => { anim.cancel(); };
  }, []);
  return <p ref={ref} className="text-xs text-red-600">{message}</p>;
}

export function AuthLayout() {
  const { login, register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";

  const cardRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLFormElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const buttonTextRef = useRef<HTMLSpanElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLParagraphElement>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const isRegister = pathname === "/register";

  const buttonLabel = isRegister
    ? loading ? "Creating account…" : "Create account"
    : loading ? "Signing in…" : "Sign in";

  useEffect(() => {
    setLoading(false);
    setConfirmPassword("");
    setError(null);
    setFieldErrors({});
  }, [pathname]);

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (!username.trim()) {
      errs.username = "Username is required";
    } else if (isRegister && username.length < 3) {
      errs.username = "Must be at least 3 characters";
    }
    if (!password) {
      errs.password = "Password is required";
    } else if (isRegister && password.length < 8) {
      errs.password = "Must be at least 8 characters";
    }
    if (isRegister && password !== confirmPassword) {
      errs.confirmPassword = "Passwords do not match";
    }
    return errs;
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setError(null);
    setLoading(true);
    try {
      if (isRegister) {
        await register(username, password);
        navigate("/", { replace: true });
      } else {
        await login(username, password);
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Card height tracks the wrapper frame-by-frame — no CSS transition so the
  // ResizeObserver stays in sync with the anime.js confirm-password animation.
  useLayoutEffect(() => {
    const card = cardRef.current;
    const wrapper = wrapperRef.current;
    if (!card || !wrapper) return;

    card.style.height = `${wrapper.offsetHeight}px`;

    const ro = new ResizeObserver((entries) => {
      const h =
        entries[0].borderBoxSize?.[0]?.blockSize ?? wrapper.offsetHeight;
      card.style.height = `${h}px`;
    });

    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  // Collapse confirm-password wrapper before first paint when starting on /login.
  // Only marginTop is zeroed out — the gap below the collapsed field is intentionally
  // kept so the button has consistent spacing regardless of route.
  useLayoutEffect(() => {
    const el = confirmRef.current;
    if (!el || isRegister) return;
    el.style.height = "0px";
    el.style.marginTop = `${-GAP}px`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate confirm-password on route change.
  const isFirstRender = useRef(true);
  useEffect(() => {
    const el = confirmRef.current;
    if (!el) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    let anim: ReturnType<typeof animate>;

    if (isRegister) {
      el.style.height = "auto";
      const targetH = el.scrollHeight;
      el.style.height = "0px";

      anim = animate(el, {
        height: targetH,
        marginTop: 0,
        duration: 350,
        ease: "inOutCubic",
        onComplete: () => { el.style.height = "auto"; },
      });
    } else {
      // Pin to a pixel value before animating — anime.js can't tween from "auto".
      el.style.height = `${el.offsetHeight}px`;

      anim = animate(el, {
        height: 0,
        marginTop: -GAP,
        duration: 350,
        ease: "inOutCubic",
      });
    }

    return () => { anim.cancel(); };
  }, [isRegister]);

  useFadeIn(titleRef, pathname, { duration: 150, delay: 30 });
  useFadeIn(buttonTextRef, buttonLabel, { duration: 150, delay: 30 });
  useFadeIn(footerRef, pathname, { duration: 150, delay: 60 });
  useFadeIn(errorRef, error, { duration: 150 });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
      <div
        ref={cardRef}
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-lg"
      >
        <form
          ref={wrapperRef}
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4 px-8 py-10"
        >
          <h2
            ref={titleRef}
            className="text-center text-lg font-semibold text-gray-800"
          >
            {PAGE_TITLES[pathname]}
          </h2>

          <div className="flex flex-col gap-1">
            <label className={labelCls} htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              minLength={isRegister ? 3 : undefined}
              value={username}
              onChange={(e) => { setUsername(e.target.value); clearFieldError("username"); }}
              className={inputCls}
            />
            {fieldErrors.username && (
              <FieldError key={fieldErrors.username} message={fieldErrors.username} />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelCls} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={isRegister ? 8 : undefined}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError("password");
                clearFieldError("confirmPassword");
              }}
              className={inputCls}
            />
            {fieldErrors.password && (
              <FieldError key={fieldErrors.password} message={fieldErrors.password} />
            )}
          </div>

          {/* Confirm-password — height and top margin animated by anime.js */}
          <div
            ref={confirmRef}
            style={{ overflow: "hidden" }}
            className="flex flex-col gap-1"
          >
            <label className={labelCls} htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required={isRegister}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError("confirmPassword"); }}
              className={inputCls}
            />
            {fieldErrors.confirmPassword && (
              <FieldError key={fieldErrors.confirmPassword} message={fieldErrors.confirmPassword} />
            )}
          </div>

          {error && (
            <div
              ref={errorRef}
              className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-gray-900 py-2 font-semibold text-white transition hover:bg-black disabled:opacity-60"
          >
            <span ref={buttonTextRef}>{buttonLabel}</span>
          </button>

          <p ref={footerRef} className="text-center text-sm text-gray-500">
            {isRegister ? "Already have an account? " : "No account? "}
            <Link
              to={isRegister ? "/login" : "/register"}
              className="font-medium text-[var(--color-accent-primary)] hover:underline"
            >
              {isRegister ? "Log in →" : "Register here →"}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
