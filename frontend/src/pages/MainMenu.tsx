import { useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Logo, Icon, Button, UserDropdown } from "../components/ui";
import { animate, stagger } from "animejs";
import singleplayerIcon from "../assets/singleplayer.svg";
import multiIcon from "../assets/multiplayer.svg";
import statsIcon from "../assets/stats.svg";
import tutorialIcon from "../assets/tutorial.svg";
import settingsIcon from "../assets/settings.svg";
import trophyIcon from "../assets/trophy.webp";

export default function MainMenu() {
  const navigate = useNavigate();
  const { status, username, logout } = useAuth();

  const isAuth = status === "authenticated";

  const wordmarkRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLParagraphElement>(null);
  const [showMultiplayerMenu, setShowMultiplayerMenu] = useState(false);

  useLayoutEffect(() => {
    const wordmark = wordmarkRef.current;
    const tagline = taglineRef.current;
    const tiles = gridRef.current
      ? (Array.from(gridRef.current.querySelectorAll(".tile")) as HTMLElement[])
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
        // After entrance, remove inline opacity so disabled tiles revert to CSS opacity: 0.55
        onComplete: () =>
          tiles.forEach((el) => el.style.removeProperty("opacity")),
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
              username={username ?? ""}
              onSignOut={() => void logout()}
            />
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/login")}
              >
                Sign in
              </Button>
              <Button
                variant="dark"
                size="sm"
                onClick={() => navigate("/register")}
              >
                Sign up
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 24px 40px",
        }}
      >
        {/* Wordmark */}
        <div
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
          className="elo-banner"
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
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: "var(--color-ink)",
              }}
            >
              Picross Ranked
            </div>

            <p
              style={{
                margin: 0,
                fontSize: 20,
                color: "var(--color-ink-muted)",
              }}
            >
              Complete. Climb. Conquer.
            </p>

            <div
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
                    1200
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Side */}
          <div
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
                  ? () => navigate("/picrossranked")
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
            style={{
              display: "flex",
              gap: 20,
            }}
          >
            {/* Singleplayer */}
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

            {/* Multiplayer */}
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                position: "relative",
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
                      navigate("/multiplayer/ranked");
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
              onClick={() => navigate("/settings")}
            />
          </div>
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
        {isAuth
          ? `Welcome back, ${username ?? ""}.`
          : "Playing as a guest. Sign in to save progress."}
      </p>
    </div>
  );
}

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
    <button
      className="tile"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 640,
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
