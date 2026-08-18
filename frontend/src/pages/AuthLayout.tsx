import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type SubmitEvent,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { animate } from "animejs";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { SSO_BUTTON_LABEL } from "../auth/ssoLabel";

const inputCls =
  "rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-[var(--color-accent-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)]/20";
const labelCls = "text-sm font-medium text-gray-700";

// gap-4 = 1rem = 16px, cancelled via marginTop while the credentials block is
// collapsed: flexbox `gap` still inserts space around a zero-height child.
const GAP = 16;

type FieldErrors = {
  username?: string;
  password?: string;
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
    return () => {
      anim.cancel();
    };
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
    const anim = animate(el, {
      opacity: [0, 1],
      duration: 150,
      ease: "outCubic",
    });
    return () => {
      anim.cancel();
    };
  }, []);
  return (
    <p ref={ref} className="text-xs text-red-600">
      {message}
    </p>
  );
}

export function AuthLayout() {
  const { login, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? "/";

  const startExpanded =
    new URLSearchParams(location.search).get("admin") === "1";

  const cardRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLFormElement>(null);
  const credentialsRef = useRef<HTMLDivElement>(null);
  const buttonTextRef = useRef<HTMLSpanElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // `expanded` drives aria-expanded and the animation direction. `mounted`
  // controls whether the credentials block exists in the DOM at all: it stays
  // true for the duration of the close animation, then flips false once the
  // animation completes, so the form is only ever briefly present while it is
  // visibly opening or closing, never while sitting collapsed.
  const [expanded, setExpanded] = useState(startExpanded);
  const [mounted, setMounted] = useState(startExpanded);
  const pendingOpen = useRef(false);

  const buttonLabel = loading ? "Signing in…" : "Sign in";

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
    if (!username.trim()) errs.username = "Username is required";
    if (!password) errs.password = "Password is required";
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
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleExpanded() {
    if (expanded) {
      setError(null);
      setExpanded(false);
    } else {
      pendingOpen.current = true;
      setMounted(true);
      setExpanded(true);
    }
  }

  // Card height tracks the wrapper frame-by-frame, no CSS transition so the
  // ResizeObserver stays in sync with the anime.js credentials-block animation.
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

  // A block that just mounted to be animated open must start from height 0
  // before the browser paints, otherwise it flashes at full height for a
  // frame before the open animation (a regular effect, which runs after
  // paint) gets a chance to collapse it back down first.
  useLayoutEffect(() => {
    if (!mounted || !pendingOpen.current) return;
    const el = credentialsRef.current;
    if (el) {
      el.style.height = "0px";
      el.style.marginTop = `${-GAP}px`;
    }
  }, [mounted]);

  // Animate the credentials block open or closed on toggle.
  const isFirstRender = useRef(true);
  useEffect(() => {
    // Flip this unconditionally, before the `!el` bailout below. Otherwise,
    // when the block starts unmounted, the true first run (el still null)
    // would never clear the flag, and the first *real* open (the next run,
    // once el exists) would be mistaken for the initial render and skip
    // its animation entirely.
    const wasFirstRender = isFirstRender.current;
    isFirstRender.current = false;

    const el = credentialsRef.current;
    if (!el) return;

    if (wasFirstRender) {
      pendingOpen.current = false;
      return;
    }

    let anim: ReturnType<typeof animate>;

    if (expanded) {
      el.style.height = "auto";
      const targetH = el.scrollHeight;
      el.style.height = "0px";

      anim = animate(el, {
        height: targetH,
        marginTop: 0,
        duration: 350,
        ease: "inOutCubic",
        onComplete: () => {
          el.style.height = "auto";
        },
      });
    } else {
      // Pin to a pixel value before animating, anime.js can't tween from "auto".
      el.style.height = `${el.offsetHeight}px`;

      anim = animate(el, {
        height: 0,
        marginTop: -GAP,
        duration: 350,
        ease: "inOutCubic",
        onComplete: () => {
          setMounted(false);
        },
      });
    }

    pendingOpen.current = false;

    return () => {
      anim.cancel();
    };
  }, [expanded]);

  useFadeIn(buttonTextRef, buttonLabel, { duration: 150, delay: 30 });
  useFadeIn(errorRef, error, { duration: 150 });

  // Returning via browser back restores this component from bfcache with its
  // state intact, which would otherwise leave the button stuck mid-redirect.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) setRedirecting(false);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

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
          <h2 className="text-center text-lg font-semibold text-gray-800">
            Sign in
          </h2>

          <button
            type="button"
            disabled={redirecting}
            onClick={() => {
              setRedirecting(true);
              signIn(from);
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 py-2 font-semibold text-white shadow-sm transition duration-150 hover:bg-black hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 active:translate-y-px active:shadow-sm disabled:cursor-wait disabled:opacity-80 disabled:shadow-sm"
          >
            {redirecting && (
              <svg
                className="animate-spin"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  opacity="0.25"
                />
                <path
                  d="M22 12a10 10 0 0 0-10-10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {redirecting ? "Redirecting…" : SSO_BUTTON_LABEL}
          </button>

          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={expanded}
            aria-controls="service-account-form"
            className="mx-auto flex items-center gap-1 text-xs font-medium text-gray-400 transition hover:text-gray-600"
          >
            I&apos;m an admin
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 220ms ease",
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {mounted && (
            <div
              id="service-account-form"
              ref={credentialsRef}
              style={{ overflow: "hidden" }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1">
                <label className={labelCls} htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    clearFieldError("username");
                  }}
                  className={inputCls}
                />
                {fieldErrors.username && (
                  <FieldError
                    key={fieldErrors.username}
                    message={fieldErrors.username}
                  />
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className={labelCls} htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError("password");
                  }}
                  className={inputCls}
                />
                {fieldErrors.password && (
                  <FieldError
                    key={fieldErrors.password}
                    message={fieldErrors.password}
                  />
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
                className="rounded-xl border border-gray-300 py-2 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                <span ref={buttonTextRef}>{buttonLabel}</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
