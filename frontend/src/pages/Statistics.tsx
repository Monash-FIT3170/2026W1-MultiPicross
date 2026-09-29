import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAchievementDefinitions, useMyAchievements } from "../api/achievements";
import { fmtSeconds } from "../components/NonogramGrid";
import { Logo, BackButton, Icon, StatTile } from "../components/ui";

interface Completion {
  id: string;
  puzzleId: string;
  width: number;
  height: number;
  elapsedSeconds: number;
  livesLeft: number;
  completedAt: string;
}

type Tab = "stats" | "achievements";

export function Statistics() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("stats");
  const [completions, setCompletions] = useState<Completion[] | null>(null);

  const { definitions } = useAchievementDefinitions();
  const { achievements } = useMyAchievements(tab === "achievements");

  useEffect(() => {
    let cancelled = false;
    apiFetch("/singleplayer/history")
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as { completions: Completion[] };
        if (!cancelled) setCompletions(body.completions);
      })
      .catch(() => {
        if (!cancelled) setCompletions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-paper)",
        padding: "24px 24px 80px",
      }}
    >
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
        <div style={{ width: 100 }} />
      </div>

      <h1
        style={{
          textAlign: "center",
          margin: "0 0 6px",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--color-ink)",
        }}
      >
        Statistics
      </h1>
      <p
        style={{
          textAlign: "center",
          margin: "0 0 28px",
          color: "var(--color-ink-muted)",
          fontSize: 13,
        }}
      >
        Your puzzle stats and achievements.
      </p>

      <div
        role="tablist"
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          marginBottom: 32,
        }}
      >
        <TabButton
          label="Stats"
          icon="bar-chart"
          active={tab === "stats"}
          onClick={() => setTab("stats")}
        />
        <TabButton
          label="Achievements"
          icon="trophy"
          active={tab === "achievements"}
          onClick={() => setTab("achievements")}
        />
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        {tab === "stats" && <StatsTab completions={completions} />}
        {tab === "achievements" && (
          <AchievementsTab definitions={definitions} achievements={achievements} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: "bar-chart" | "trophy";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 20px",
        borderRadius: 10,
        border: `1px solid ${active ? "var(--color-blue-500)" : "var(--color-line)"}`,
        background: active ? "var(--color-blue-500)" : "#fff",
        color: active ? "#fff" : "var(--color-ink)",
        fontFamily: "var(--font-ui)",
        fontWeight: 600,
        fontSize: 14,
        cursor: "pointer",
        transition: "background-color 120ms ease, border-color 120ms ease",
      }}
    >
      <Icon name={icon} size={15} color={active ? "#fff" : "var(--color-ink-faint)"} />
      {label}
    </button>
  );
}

function StatsTab({ completions }: { completions: Completion[] | null }) {
  if (completions === null) {
    return <EmptyState label="Loading…" />;
  }
  if (completions.length === 0) {
    return <EmptyState label="Complete a singleplayer puzzle to see stats here." />;
  }

  const totalCompleted = completions.length;
  const totalSeconds = completions.reduce((sum, c) => sum + c.elapsedSeconds, 0);
  const avgSeconds = Math.round(totalSeconds / totalCompleted);
  const bestSeconds = Math.min(...completions.map((c) => c.elapsedSeconds));
  const perfectClears = completions.filter((c) => c.livesLeft === 3).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        className="mp-surface"
        style={{
          padding: "28px 24px",
          display: "flex",
          justifyContent: "space-around",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        <StatTile icon="grid" label="Puzzles completed">
          {totalCompleted}
        </StatTile>
        <StatTile icon="clock" label="Average time">
          {fmtSeconds(avgSeconds)}
        </StatTile>
        <StatTile icon="clock" label="Best time">
          {fmtSeconds(bestSeconds)}
        </StatTile>
        <StatTile icon="heart" label="Perfect clears">
          {perfectClears}
        </StatTile>
      </div>

      <div className="mp-surface" style={{ padding: "8px 0" }}>
        {completions.slice(0, 10).map((c, i) => (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 20px",
              borderTop: i === 0 ? "none" : "1px solid var(--color-line)",
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--color-ink)", fontWeight: 600 }}>
              {c.width} × {c.height}
            </span>
            <span style={{ color: "var(--color-ink-muted)" }}>
              {fmtSeconds(c.elapsedSeconds)} · {c.livesLeft}/3 lives
            </span>
            <span style={{ color: "var(--color-ink-faint)", fontSize: 12 }}>
              {new Date(c.completedAt).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AchievementsTab({
  definitions,
  achievements,
}: {
  definitions: import("../api/achievements").AchievementDef[] | null;
  achievements: import("../api/achievements").MyAchievement[] | null;
}) {
  if (definitions === null || achievements === null) {
    return <EmptyState label="Loading…" />;
  }

  const byKey = new Map(achievements.map((a) => [a.key, a]));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 14,
      }}
    >
      {definitions.map((def) => {
        const mine = byKey.get(def.key);
        const unlocked = !!mine?.unlockedAt;
        const progress = Math.min(mine?.progress ?? 0, def.goal);

        return (
          <div
            key={def.key}
            className="mp-surface"
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              opacity: unlocked ? 1 : 0.55,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  flexShrink: 0,
                  background: unlocked
                    ? "var(--color-butter-300)"
                    : "var(--color-line)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  name={def.icon}
                  size={16}
                  color={unlocked ? "#fff" : "var(--color-ink-faint)"}
                />
              </div>
              <div
                style={{ fontWeight: 700, fontSize: 14, color: "var(--color-ink)" }}
              >
                {def.name}
              </div>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: "var(--color-ink-muted)" }}>
              {def.description}
            </p>

            {unlocked ? (
              <div style={{ fontSize: 11, color: "var(--color-sage-500)", fontWeight: 600 }}>
                Unlocked {new Date(mine!.unlockedAt!).toLocaleDateString()}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div
                  style={{
                    height: 6,
                    borderRadius: 999,
                    background: "var(--color-line)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(progress / def.goal) * 100}%`,
                      background: "var(--color-blue-500)",
                      borderRadius: 999,
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, color: "var(--color-ink-faint)" }}>
                  {progress} / {def.goal}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 20px",
        color: "var(--color-ink-faint)",
        fontSize: 14,
      }}
    >
      {label}
    </div>
  );
}
