import { useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo, Icon, Button, UserDropdown } from "../components/ui";
import { animate, stagger } from "animejs";
import { useElo } from "../api/elo";
import singleplayerIcon from "../assets/singleplayer.svg";
import multiIcon from "../assets/multiplayer.svg";
import statsIcon from "../assets/stats.svg";
import tutorialIcon from "../assets/tutorial.svg";
import settingsIcon from "../assets/settings.svg";
import trophyIcon from "../assets/trophy.webp";
import { useSettings } from "../components/settings/SettingsContext";

/* ------------------------------------------------------------------ */
/* Character layers                                                    */
/* ------------------------------------------------------------------ */

const loadLayer = (modules: Record<string, string>) =>
  Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, url]) => url);

// Listed back-to-front: later entries draw on top.
const LAYERS = [
  {
    key: "face",
    label: "Face",
    optional: false,
    assets: loadLayer(
      import.meta.glob("../assets/character/Face/*.png", {
        eager: true,
        import: "default",
      }) as Record<string, string>,
    ),
  },
  {
    key: "nose",
    label: "Nose",
    optional: false,
    assets: loadLayer(
      import.meta.glob("../assets/character/Nose/*.png", {
        eager: true,
        import: "default",
      }) as Record<string, string>,
    ),
  },
  {
    key: "mouth",
    label: "Mouth",
    optional: false,
    assets: loadLayer(
      import.meta.glob("../assets/character/Mouth/*.png", {
        eager: true,
        import: "default",
      }) as Record<string, string>,
    ),
  },
  {
    key: "eyes",
    label: "Eyes",
    optional: false,
    assets: loadLayer(
      import.meta.glob("../assets/character/Eyes/*.png", {
        eager: true,
        import: "default",
      }) as Record<string, string>,
    ),
  },
  {
    key: "eyebrows",
    label: "Brows",
    optional: false,
    assets: loadLayer(
      import.meta.glob("../assets/character/Eyebrows/*.png", {
        eager: true,
        import: "default",
      }) as Record<string, string>,
    ),
  },
  {
    key: "hair",
    label: "Hair",
    optional: true,
    assets: loadLayer(
      import.meta.glob("../assets/character/Hair/*.png", {
        eager: true,
        import: "default",
      }) as Record<string, string>,
    ),
  },
  {
    key: "accessories",
    label: "Access.",
    optional: true,
    assets: loadLayer(
      import.meta.glob("../assets/character/Accessories/*.png", {
        eager: true,
        import: "default",
      }) as Record<string, string>,
    ),
  },
  {
    key: "weapon",
    label: "Weapon",
    optional: true,
    assets: loadLayer(
      import.meta.glob("../assets/character/Weapon/*.png", {
        eager: true,
        import: "default",
      }) as Record<string, string>,
    ),
  },
] as const;

type LayerKey = (typeof LAYERS)[number]["key"];
type CharacterState = Record<LayerKey, number>;

// Required layers start at 1, optional layers start at 0 ("None")
const DEFAULT_CHARACTER = Object.fromEntries(
  LAYERS.map((l) => [l.key, l.optional ? 0 : 1]),
) as CharacterState;

const SPRITE_SIZE = 32; // native px size of your sprites
const SCALE = 4; // whole numbers only
const PREVIEW = SPRITE_SIZE * SCALE; // 128

/* ------------------------------------------------------------------ */
/* Main menu                                                           */
/* ------------------------------------------------------------------ */

export default function MainMenu() {
  const navigate = useNavigate();
  const { status, user, guestNickname, playerName, logout } = useAuth();

  const isAuth = status === "authenticated";
  const { openSettings } = useSettings();

  const wordmarkRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLParagraphElement>(null);
  const [showMultiplayerMenu, setShowMultiplayerMenu] = useState(false);
  const [creatorName, setCreatorName] = useState(
    isAuth ? playerName ?? user?.handle ?? "Nova" : guestNickname ?? "Guest",
  );
  const [character, setCharacter] = useState<CharacterState>(DEFAULT_CHARACTER);
  const { playerElo } = useElo(isAuth);

  useLayoutEffect(() => {
    const wordmark = wordmarkRef.current;
    const tagline = taglineRef.current;
    const tiles = gridRef.current
      ? (Array.from(
          gridRef.current.querySelectorAll(".tile-enter"),
        ) as HTMLElement[])
      : [];
    const footer = footerRef.current;

    const headEls = [wordmark, tagline].filter(Boolean) as HTMLElement[];
    const allEls = [...headEls, ...tiles, ...(footer ? [footer] : [])];

    allEls.forEach((el) => {
      el.style.opacity = "0";
    });

    animate(headEls, {
      opacity: [0, 1],
      translateY: ["10px", "0px"],
      delay: stagger(70),
      duration: 380,
      ease: "outExpo",
    });

    if (tiles.length) {
      animate(tiles, {
        opacity: [0, 1],
        translateY: ["10px", "0px"],
        delay: stagger(55, { start: 140 }),
        duration: 300,
        ease: "outExpo",
      });
    }

    if (footer) {
      animate(footer, {
        opacity: [0, 1],
        translateY: ["6px", "0px"],
        duration: 240,
        delay: 450,
        ease: "outExpo",
      });
    }
  }, []);

  return (
    <div
      className="mp-page mp-main-menu"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-paper)",
        position: "relative",
      }}
      onClick={() => setShowMultiplayerMenu(false)}
    >
      {/* Top bar */}
      <div
        className="mp-topbar mp-main-topbar"
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          right: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
        }}
      >
        <Logo size={28} />
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, height: 44 }}
        >
          {isAuth ? (
            <UserDropdown
              handle={user?.handle ?? null}
              onSignOut={() => void logout()}
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/login")}
            >
              Sign in
            </Button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div
        className="mp-main-content"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 24px 40px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: 28,
            width: "100%",
            maxWidth: 1060,
          }}
        >
          <div style={{ width: 640 }}>
            {/* Wordmark */}
            <div
              className="mp-wordmark"
              ref={wordmarkRef}
              style={{
                fontFamily: "Cairo, sans-serif",
                fontWeight: 700,
                fontSize: 48,
                letterSpacing: "-0.015em",
                color: "var(--color-ink)",
                marginBottom: 8,
              }}
            >
              Multi<span style={{ color: "var(--color-blue-500)" }}>Picross</span>
            </div>
            <p
              ref={taglineRef}
              style={{
                fontSize: 15,
                color: "var(--color-ink-muted)",
                marginBottom: 40,
                marginTop: 0,
              }}
            >
              Nonograms, now social.
            </p>

            {/* ELO ranking banner */}
            <div
              className="elo-banner mp-ranked-banner"
              style={{
                padding: 28,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: 640,
                height: 220,
                background: "linear-gradient(135deg, #EAF3FF 0%, #F7FBFF 100%)",
                border: "1px solid #D6E6FF",
                borderRadius: 20,
              }}
            >
              {/* Left Side */}
              <div
                className="mp-ranked-copy"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 10,
                  flex: 1,
                  paddingRight: 40,
                }}
              >
                <div
                  className="mp-ranked-title"
                  style={{
                    fontSize: 36,
                    fontWeight: 700,
                    color: "var(--color-ink)",
                  }}
                >
                  Picross Ranked
                </div>

                <p
                  className="mp-ranked-subtitle"
                  style={{
                    margin: 0,
                    fontSize: 20,
                    color: "var(--color-ink-muted)",
                  }}
                >
                  Complete. Climb. Conquer.
                </p>

                <div
                  className="mp-ranked-rating"
                  style={{
                    marginTop: 20,
                    color: "var(--color-ink-muted)",
                  }}
                >
                  {isAuth && (
                    <>
                      <div
                        style={{
                          fontSize: 18,
                          color: "var(--color-ink-muted)",
                        }}
                      >
                        Current Rating
                      </div>

                      <div
                        style={{
                          fontSize: 60,
                          fontWeight: 600,
                          marginTop: 12,
                          wordSpacing: "0.04em",
                          color: "var(--color-ink)",
                        }}
                      >
                        {playerElo ?? 100}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Side */}
              <div
                className="mp-ranked-art"
                style={{
                  width: 180,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <img
                  src={trophyIcon}
                  alt=""
                  style={{ width: 120, height: 120, opacity: 0.85 }}
                />
                <Button
                  variant="primary"
                  size="md"
                  onClick={
                    isAuth
                      ? () => navigate("/multiplayer/ranked")
                      : () => navigate("/login")
                  }
                  style={{
                    width: 200,
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  {isAuth ? "Play Now" : "Sign In To Play"}
                </Button>
              </div>
            </div>

            {/* Main content */}
            <div
              className="mp-menu-grid"
              ref={gridRef}
              style={{
                width: 640,
                display: "flex",
                flexDirection: "column",
                gap: 20,
                marginTop: 24,
              }}
            >
              {/* Player options */}
              <div
                className="mp-primary-actions"
                style={{
                  display: "flex",
                  gap: 20,
                }}
              >
                {/* Singleplayer */}
                <div className="tile-enter" style={{ flex: 1, display: "flex" }}>
                  <button
                    className="tile"
                    onClick={() => navigate("/singleplayer")}
                    style={{
                      flex: 1,
                      height: 120,
                    }}
                  >
                    <img
                      src={singleplayerIcon}
                      alt=""
                      style={{ width: 40, height: 40, opacity: 0.85 }}
                    />
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: "var(--color-ink)",
                      }}
                    >
                      Singleplayer
                    </span>
                  </button>
                </div>

                {/* Multiplayer */}
                <div
                  className="tile-enter mp-multiplayer-picker"
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    flex: 1,
                  }}
                >
                  {showMultiplayerMenu ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        width: "100%",
                        height: 120,
                      }}
                    >
                      <ModeButton
                        label="Unrated"
                        onClick={() => {
                          setShowMultiplayerMenu(false);
                          navigate("/multiplayer/unrated");
                        }}
                      />
                      <ModeButton
                        label="Ranked"
                        onClick={() => {
                          setShowMultiplayerMenu(false);
                          navigate(isAuth ? "/multiplayer/ranked" : "/login");
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      className="tile"
                      onClick={() => setShowMultiplayerMenu(true)}
                      style={{
                        width: "100%",
                        height: 120,
                      }}
                    >
                      <img
                        src={multiIcon}
                        alt=""
                        style={{ width: 40, height: 40, opacity: 0.85 }}
                      />
                      <span
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: "var(--color-ink)",
                        }}
                      >
                        Multiplayer
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Other features */}
              <div
                className="mp-secondary-actions"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* Collection */}
                <SecondaryTile
                  disabled={!isAuth}
                  icon={<Icon name="grid" size={20} color="var(--color-ink)" />}
                  label="Collection"
                  onClick={isAuth ? () => navigate("/collection") : undefined}
                  badge={!isAuth ? <SignInHint /> : undefined}
                />

                {/* Statistics */}
                <SecondaryTile
                  disabled={!isAuth}
                  icon={
                    <img
                      src={statsIcon}
                      alt=""
                      style={{ width: 20, height: 20, opacity: 0.8 }}
                    />
                  }
                  label="Statistics"
                  onClick={isAuth ? () => navigate("/statistics") : undefined}
                  badge={!isAuth ? <SignInHint /> : undefined}
                />

                {/* Tutorial */}
                <SecondaryTile
                  icon={
                    <img
                      src={tutorialIcon}
                      alt=""
                      style={{ width: 20, height: 20, opacity: 0.8 }}
                    />
                  }
                  label="Tutorial"
                  onClick={() => navigate("/tutorial")}
                />

                {/* Settings */}
                <SecondaryTile
                  icon={
                    <img
                      src={settingsIcon}
                      alt=""
                      style={{ width: 20, height: 20, opacity: 0.8 }}
                    />
                  }
                  label="Settings"
                  onClick={openSettings}
                />
              </div>
            </div>

            {/* Footer hint */}
            <p
              ref={footerRef}
              style={{
                marginTop: 36,
                fontSize: 12,
                color: "var(--color-ink-faint)",
              }}
            >
              {isAuth && playerName
                ? `Welcome back, ${playerName}.`
                : isAuth
                  ? "Welcome back."
                  : guestNickname
                    ? `Playing as ${guestNickname}. Sign in to save progress.`
                    : "Playing as a guest. Sign in to save progress."}
            </p>
          </div>

          <CharacterCreator
            creatorName={creatorName}
            onCreatorNameChange={setCreatorName}
            character={character}
            onCharacterChange={(key, value) =>
              setCharacter((prev) => ({ ...prev, [key]: value }))
            }
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */

function SignInHint() {
  return (
    <span
      style={{
        fontSize: 14,
        color: "var(--color-ink-faint)",
        fontWeight: 600,
        padding: "2px 14px",
        letterSpacing: "0.02em",
      }}
    >
      Sign in
    </span>
  );
}

function SecondaryTile({
  icon,
  label,
  onClick,
  disabled = false,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div className="tile-enter">
      <button
        className="tile mp-secondary-tile"
        disabled={disabled}
        onClick={onClick}
        style={{
          width: "100%",
          maxWidth: 640,
          height: 56,
          flexDirection: "row",
          gap: 24,
          padding: "0 18px",
          justifyContent: "flex-start",
        }}
      >
        {icon}
        <span
          style={{ fontSize: 18, fontWeight: 600, color: "var(--color-ink)" }}
        >
          {label}
        </span>
        {badge && <span style={{ marginLeft: "auto" }}>{badge}</span>}
      </button>
    </div>
  );
}

function CharacterCreator({
  creatorName,
  onCreatorNameChange,
  character,
  onCharacterChange,
}: {
  creatorName: string;
  onCreatorNameChange: (value: string) => void;
  character: CharacterState;
  onCharacterChange: (key: LayerKey, value: number) => void;
}) {
  return (
    <div
      style={{
        width: 300,
        background: "linear-gradient(180deg, #F8FBFF 0%, #EEF4FF 100%)",
        border: "1px solid #D7E7FF",
        borderRadius: 24,
        boxShadow: "0 18px 50px rgba(24, 59, 116, 0.08)",
        padding: 18,
      }}
    >
      <div
        style={{
          background: "linear-gradient(180deg, #EAF3FF 0%, #F7FBFF 100%)",
          border: "1px solid #D2E1FF",
          borderRadius: 18,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            position: "relative",
            width: PREVIEW,
            height: PREVIEW,
            margin: "0 auto 14px",
          }}
        >
          {LAYERS.map((layer, i) => {
            const src = layer.assets[character[layer.key] - 1];
            if (!src) return null; // "None" or missing file
            return (
              <img
                key={layer.key}
                src={src}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: PREVIEW,
                  height: PREVIEW,
                  imageRendering: "pixelated",
                  zIndex: i + 1,
                }}
              />
            );
          })}
        </div>

        <label
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--color-ink-muted)",
            marginBottom: 8,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Name
        </label>
        <input
          value={creatorName}
          onChange={(event) => onCreatorNameChange(event.target.value)}
          placeholder="Enter a name"
          style={{
            width: "100%",
            border: "1px solid #D4E0FB",
            background: "var(--color-white)",
            borderRadius: 12,
            padding: "10px 12px",
            fontSize: 16,
            color: "var(--color-ink)",
            outline: "none",
          }}
        />
      </div>

      {LAYERS.map((layer) => (
        <FeaturePicker
          key={layer.key}
          label={layer.label}
          value={character[layer.key]}
          total={layer.assets.length}
          min={layer.optional ? 0 : 1}
          onChange={(v) => onCharacterChange(layer.key, v)}
        />
      ))}
    </div>
  );
}

function FeaturePicker({
  label,
  value,
  total,
  min = 1,
  onChange,
}: {
  label: string;
  value: number;
  total: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  const empty = total === 0;
  const decrement = () => onChange(value <= min ? total : value - 1);
  const increment = () => onChange(value >= total ? min : value + 1);

  const arrowStyle = {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: "1px solid #D7E7FF",
    background: "#fff",
    cursor: empty ? "not-allowed" : "pointer",
    opacity: empty ? 0.4 : 1,
    color: "var(--color-ink)",
    fontSize: 18,
    lineHeight: 1,
  } as const;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "var(--color-ink-muted)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          width: 64,
        }}
      >
        {label}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flex: 1,
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          aria-label={`Previous ${label.toLowerCase()} option`}
          disabled={empty}
          onClick={decrement}
          style={arrowStyle}
        >
          ←
        </button>

        <div
          style={{
            minWidth: 50,
            textAlign: "center",
            fontSize: value === 0 ? 14 : 18,
            fontWeight: 800,
            color: "var(--color-ink)",
          }}
        >
          {empty ? "–" : value === 0 ? "None" : `(${value})`}
        </div>

        <button
          type="button"
          aria-label={`Next ${label.toLowerCase()} option`}
          disabled={empty}
          onClick={increment}
          style={arrowStyle}
        >
          →
        </button>
      </div>
    </div>
  );
}

function ModeButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="mode-button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        height: 56,
        padding: "10px 8px",
        background: "var(--color-white)",
        border: "1px solid #D6E6FF",
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "center",
        fontSize: 18,
        fontWeight: 600,
        color: "var(--color-ink)",
      }}
    >
      {label}
    </button>
  );
}
