import {
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";

// ──── Icon ────────────────────────────────────────────────────────────────────

export type IconName =
  | "arrow-left"
  | "clock"
  | "heart"
  | "users"
  | "user"
  | "grid"
  | "trophy"
  | "plus"
  | "key"
  | "x"
  | "check"
  | "info"
  | "bar-chart"
  | "settings"
  | "home"
  | "refresh";

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}

export function Icon({
  name,
  size = 16,
  color = "currentColor",
  strokeWidth = 2,
  style,
}: IconProps) {
  const p: React.SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { flexShrink: 0, ...style },
  };
  switch (name) {
    case "arrow-left":
      return (
        <svg {...p}>
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      );
    case "clock":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "heart":
      return (
        <svg {...p}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    case "users":
      return (
        <svg {...p}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "user":
      return (
        <svg {...p}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "grid":
      return (
        <svg {...p}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...p}>
          <polyline points="8 6 4 6 4 13 8 13" />
          <polyline points="16 6 20 6 20 13 16 13" />
          <path d="M8 21H16" />
          <path d="M12 17v4" />
          <path d="M8 6C8 6 8 13 12 13s4-7 4-7" />
        </svg>
      );
    case "plus":
      return (
        <svg {...p}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case "key":
      return (
        <svg {...p}>
          <circle cx="8" cy="15" r="4" />
          <line x1="15" y1="8" x2="21" y2="2" />
          <line x1="17" y1="6" x2="20" y2="9" />
          <polyline points="15 8 15 12 11 12" />
        </svg>
      );
    case "x":
      return (
        <svg {...p}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case "check":
      return (
        <svg {...p}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case "info":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
    case "bar-chart":
      return (
        <svg {...p}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case "settings":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.07 4.93a9 9 0 0 1 0 12.73" />
          <path d="M4.93 4.93a9 9 0 0 0 0 12.73" />
          <path d="M19.07 19.07a9 9 0 0 1-12.73 0" />
          <path d="M4.93 19.07a9 9 0 0 0 12.73 0" />
        </svg>
      );
    case "home":
      return (
        <svg {...p}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...p}>
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      );
    default:
      return null;
  }
}

// ──── Logo ────────────────────────────────────────────────────────────────────

interface LogoProps {
  size?: number;
}

export function Logo({ size = 28 }: LogoProps) {
  const s = size;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        textDecoration: "none",
      }}
    >
      <svg
        width={s}
        height={s}
        viewBox="0 0 28 28"
        fill="none"
        style={{ flexShrink: 0 }}
      >
        <rect
          x="0.5"
          y="0.5"
          width="27"
          height="27"
          rx="6.5"
          fill="#fff"
          stroke="#e7e4dc"
        />
        <rect x="4" y="4" width="6" height="6" rx="1.5" fill="#3d5a80" />
        <rect x="11" y="4" width="6" height="6" rx="1.5" fill="#b8d0ec" />
        <rect x="18" y="4" width="6" height="6" rx="1.5" fill="#3d5a80" />
        <rect x="4" y="11" width="6" height="6" rx="1.5" fill="#b8d0ec" />
        <rect x="11" y="11" width="6" height="6" rx="1.5" fill="#3d5a80" />
        <rect x="18" y="11" width="6" height="6" rx="1.5" fill="#b8d0ec" />
        <rect x="4" y="18" width="6" height="6" rx="1.5" fill="#3d5a80" />
        <rect x="11" y="18" width="6" height="6" rx="1.5" fill="#b8d0ec" />
        <rect x="18" y="18" width="6" height="6" rx="1.5" fill="#3d5a80" />
      </svg>
      <span
        style={{
          fontFamily: "Cairo, sans-serif",
          fontWeight: 700,
          fontSize: s - 8,
          color: "#1c1c1e",
          letterSpacing: "-0.01em",
        }}
      >
        Multi<span style={{ color: "#3d5a80" }}>Picross</span>
      </span>
    </div>
  );
}

// ──── Button ─────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "dark" | "ghost" | "text" | "danger-soft";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const BTN_BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 10,
  border: "1px solid transparent",
  fontFamily: "var(--font-ui)",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition:
    "background-color 120ms ease, box-shadow 200ms ease, transform 200ms ease, border-color 120ms ease",
};

const VARIANT_STYLES: Record<ButtonVariant, CSSProperties> = {
  primary: { background: "var(--color-blue-500)", color: "#fff" },
  dark: { background: "#1c1c1e", color: "#fff" },
  ghost: {
    background: "#fff",
    color: "var(--color-ink)",
    borderColor: "var(--color-line)",
  },
  text: {
    background: "transparent",
    color: "var(--color-blue-500)",
    borderColor: "transparent",
  },
  "danger-soft": {
    background: "var(--color-coral-50)",
    color: "var(--color-coral-500)",
    borderColor: "var(--color-coral-100)",
  },
};

const SIZE_STYLES: Record<ButtonSize, CSSProperties> = {
  sm: { padding: "6px 12px", fontSize: 13, borderRadius: 8 },
  md: { padding: "10px 18px", fontSize: 14, borderRadius: 10 },
  lg: { padding: "12px 22px", fontSize: 16, borderRadius: 12 },
};

export function Button({
  variant = "primary",
  size = "md",
  children,
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      style={{
        ...BTN_BASE,
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...(rest.disabled ? { opacity: 0.5, cursor: "not-allowed" } : {}),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

// ──── BackButton ──────────────────────────────────────────────────────────────

interface BackButtonProps {
  onClick: () => void;
  label?: string;
}

export function BackButton({ onClick, label = "Back" }: BackButtonProps) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} style={{ gap: 6 }}>
      <Icon name="arrow-left" size={14} />
      {label}
    </Button>
  );
}

// ──── Chip ────────────────────────────────────────────────────────────────────

type ChipTone = "blue" | "sage" | "coral" | "butter" | "lavender" | "neutral";

interface ChipProps {
  tone?: ChipTone;
  children: ReactNode;
  style?: CSSProperties;
}

const CHIP_TONE: Record<ChipTone, CSSProperties> = {
  blue: { background: "var(--color-blue-100)", color: "var(--color-blue-600)" },
  sage: { background: "var(--color-sage-100)", color: "var(--color-sage-500)" },
  coral: {
    background: "var(--color-coral-100)",
    color: "var(--color-coral-500)",
  },
  butter: { background: "var(--color-butter-100)", color: "#8a7338" },
  lavender: { background: "var(--color-lavender-100)", color: "#6b5a96" },
  neutral: {
    background: "var(--color-paper)",
    color: "var(--color-ink-soft)",
    border: "1px solid var(--color-line)",
  },
};

export function Chip({ tone = "blue", children, style }: ChipProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 999,
        fontFamily: "var(--font-ui)",
        ...CHIP_TONE[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// ──── LivesPips ───────────────────────────────────────────────────────────────

interface LivesPipsProps {
  lives: number;
  max?: number;
}

export function LivesPips({ lives, max = 3 }: LivesPipsProps) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background:
              i < lives ? "var(--color-coral-400)" : "var(--color-line-strong)",
            transition: "background 200ms ease",
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

// ──── StatTile ────────────────────────────────────────────────────────────────

interface StatTileProps {
  icon: IconName;
  label: string;
  children: ReactNode;
}

export function StatTile({ icon, label, children }: StatTileProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Icon name={icon} size={13} color="var(--color-ink-faint)" />
        <span className="mp-eyebrow">{label}</span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-ui)",
          fontWeight: 700,
          fontSize: 16,
          color: "var(--color-ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ──── UserDropdown ────────────────────────────────────────────────────────────

interface UserDropdownProps {
  username: string;
  onSignOut: () => void;
}

export function UserDropdown({ username, onSignOut }: UserDropdownProps) {
  const [open, setOpen] = useState(false);
  const [panelMounted, setPanelMounted] = useState(false);
  const [panelClosing, setPanelClosing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // always-current reference so the outside-click effect never goes stale
  const closeRef = useRef<() => void>(() => {});

  function openDropdown() {
    setOpen(true);
    setPanelMounted(true);
    setPanelClosing(false);
    const el = triggerRef.current;
    if (el) {
      el.classList.remove("mp-trigger-open");
      void el.offsetWidth; // force reflow so animation restarts
      el.classList.add("mp-trigger-open");
    }
  }

  function closeDropdown() {
    setOpen(false);
    setPanelClosing(true);
    // panelMounted stays true — the panel plays its close animation,
    // then onAnimationEnd unmounts it exactly when the animation finishes
  }

  closeRef.current = closeDropdown;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeRef.current();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function handleToggle() {
    if (!open) openDropdown();
    else closeDropdown();
  }

  return (
    <div ref={containerRef} style={{ position: "relative", zIndex: 100 }}>
      {/* Trigger — always in-flow, stable height, gets CSS breathe animation on open */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        onAnimationEnd={() =>
          triggerRef.current?.classList.remove("mp-trigger-open")
        }
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "7px 12px 7px 8px",
          background: "#fff",
          border: "1px solid var(--color-line)",
          borderRadius: 10,
          borderBottomLeftRadius: panelMounted ? 0 : 10,
          borderBottomRightRadius: panelMounted ? 0 : 10,
          cursor: "pointer",
          fontFamily: "var(--font-ui)",
          boxShadow: panelMounted ? "var(--shadow-md)" : "var(--shadow-xs)",
          transition:
            "box-shadow 200ms ease, border-bottom-left-radius 120ms ease, border-bottom-right-radius 120ms ease",
          width: "100%",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            flexShrink: 0,
            background: "var(--color-blue-100)",
            color: "var(--color-blue-600)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 11,
            fontFamily: "var(--font-ui)",
          }}
        >
          {username.slice(0, 2).toUpperCase()}
        </div>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-ink-soft)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "left",
          }}
        >
          {username}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            color: "var(--color-ink-faint)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 220ms ease",
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Panel — mounts on open, stays mounted during close animation, unmounts via animationend */}
      {panelMounted && (
        <div
          onAnimationEnd={() => {
            if (panelClosing) {
              setPanelMounted(false);
              setPanelClosing(false);
            }
          }}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 200,
            transformOrigin: "top center",
            animation: panelClosing
              ? "mp-dropdown-close 300ms ease-in forwards"
              : "mp-dropdown-spring 600ms ease-out forwards",
          }}
        >
          <div
            style={{
              background: "#fff",
              border: "1px solid var(--color-line)",
              borderTop: "none",
              borderRadius: "0 0 10px 10px",
              boxShadow: "var(--shadow-md)",
              padding: "2px 4px 4px",
            }}
          >
            <button
              onClick={() => {
                closeDropdown();
                onSignOut();
              }}
              style={{
                width: "100%",
                padding: "5px 8px",
                display: "flex",
                alignItems: "center",
                gap: 7,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-coral-500)",
                textAlign: "left",
                borderRadius: 6,
                transition: "background 120ms ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "var(--color-coral-50)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "none";
              }}
            >
              <Icon name="x" size={12} color="var(--color-coral-500)" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
