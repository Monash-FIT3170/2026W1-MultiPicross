import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import {
  useAchievementDefinitions,
  useMyAchievements,
} from "../api/achievements";
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

export function Achievements() {
  const navigate = useNavigate();
  const [completions, setCompletions] = useState<Completion[] | null>(null);

  const { definitions } = useAchievementDefinitions();
  const { achievements } = useMyAchievements(true);

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
        Achievements
      </h1>
      <p
        style={{
          textAlign: "center",
          margin: "0 0 32px",
          color: "var(--color-ink-muted)",
          fontSize: 13,
        }}
      >
        Your puzzle stats and achievements.
      </p>

      <div
        style={{
          maxWidth: 780,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        <StatsSection completions={completions} />
        <AchievementsSection
          definitions={definitions}
          achievements={achievements}
        />
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--color-ink-faint)",
        margin: "0 0 12px",
      }}
    >
      {children}
    </h2>
  );
}

function StatsSection({ completions }: { completions: Completion[] | null }) {
  if (completions === null) {
    return <EmptyState label="Loading…" />;
  }
  if (completions.length === 0) {
    return (
      <EmptyState label="Complete a singleplayer puzzle to see stats here." />
    );
  }

  const totalCompleted = completions.length;
  const totalSeconds = completions.reduce(
    (sum, c) => sum + c.elapsedSeconds,
    0,
  );
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

      <div>
        <SectionHeading>Recent games</SectionHeading>
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
    </div>
  );
}

function AchievementsSection({
  definitions,
  achievements,
}: {
  definitions: import("../api/achievements").AchievementDef[] | null;
  achievements: import("../api/achievements").MyAchievement[] | null;
}) {
  return (
    <div>
      <SectionHeading>Achievements</SectionHeading>
      {definitions === null || achievements === null ? (
        <EmptyState label="Loading…" />
      ) : (
        <AchievementsGrid
          definitions={definitions}
          achievements={achievements}
        />
      )}
    </div>
  );
}

function AchievementsGrid({
  definitions,
  achievements,
}: {
  definitions: import("../api/achievements").AchievementDef[];
  achievements: import("../api/achievements").MyAchievement[];
}) {
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
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: "var(--color-ink)",
                }}
              >
                {def.name}
              </div>
            </div>

            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--color-ink-muted)",
              }}
            >
              {def.description}
            </p>

            {unlocked ? (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--color-sage-500)",
                  fontWeight: 600,
                }}
              >
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
