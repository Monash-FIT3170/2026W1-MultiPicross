import { useNavigate } from "react-router-dom";
import type { CSSProperties } from "react";
import { useState } from "react";
import { BackButton, Logo } from "../components/ui";
import { useMyRankedStats, type RankedMatchDetail } from "../api/rankedStats";

const DEFAULT_VISIBLE_MATCHES = 5;

export function Statistics() {
  const navigate = useNavigate();
  const [showAllMatches, setShowAllMatches] = useState(false);
  const { stats, loading } = useMyRankedStats(true);
  const recentMatches = stats?.recentMatches ?? [];
  const visibleMatches = showAllMatches
    ? recentMatches
    : recentMatches.slice(0, DEFAULT_VISIBLE_MATCHES);
  const hasHiddenMatches = recentMatches.length > visibleMatches.length;

  return (
    <div
      className="mp-page"
      style={{
        minHeight: "100vh",
        background: "var(--color-paper)",
        padding: 24,
      }}
    >
      <div
        className="mp-topbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
        }}
      >
        <BackButton onClick={() => navigate("/")} label="Main Menu" />
        <Logo size={34} />
        <div style={{ width: 100 }} />
      </div>

      <main style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1
          style={{
            margin: "0 0 4px",
            fontSize: 30,
            fontWeight: 700,
            color: "var(--color-ink)",
          }}
        >
          Statistics
        </h1>
        <p
          style={{
            margin: "0 0 28px",
            color: "var(--color-ink-muted)",
            fontSize: 15,
          }}
        >
          Your ranked Picross performance.
        </p>

        {loading ? (
          <section className="mp-surface" style={surfaceStyle}>
            <div style={{ color: "var(--color-ink-muted)", padding: "44px 0" }}>
              Loading statistics...
            </div>
          </section>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section className="mp-surface" style={surfaceStyle}>
              <SectionHeading
                title="Ranked Overview"
                subtitle={`${stats?.totalGames ?? 0} games played`}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <StatCard label="Rating" value={stats?.elo ?? 100} />
                <StatCard label="Rank" value={stats ? `#${stats.rank}` : "-"} />
                <StatCard
                  label="Record"
                  value={`${stats?.wins ?? 0}-${stats?.losses ?? 0}`}
                />
                <StatCard label="Win Rate" value={`${stats?.winRate ?? 0}%`} />
              </div>
            </section>

            <section className="mp-surface" style={surfaceStyle}>
              <SectionHeading
                title="Detailed Performance"
                subtitle="Mistakes and rating movement from ranked matches"
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <StatCard
                  label="Average Mistakes"
                  value={stats?.averageMistakes ?? 0}
                />
                <StatCard
                  label="Total Mistakes"
                  value={stats?.totalMistakes ?? 0}
                />
                <StatCard
                  label="Last Elo Change"
                  value={formatEloChange(stats?.lastEloChange ?? 0)}
                  tone={
                    (stats?.lastEloChange ?? 0) >= 0 ? "positive" : "negative"
                  }
                />
                <StatCard label="Recent Matches" value={recentMatches.length} />
              </div>
            </section>

            <section className="mp-surface" style={surfaceStyle}>
              <SectionHeading
                title="Recent Ranked Matches"
                subtitle={`${recentMatches.length} completed ranked games`}
              />

              {recentMatches.length === 0 ? (
                <div
                  style={{
                    padding: "34px 0",
                    color: "var(--color-ink-muted)",
                    textAlign: "center",
                    fontWeight: 650,
                  }}
                >
                  No ranked matches yet.
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {visibleMatches.map((match) => (
                    <MatchRow key={match.id} match={match} />
                  ))}
                  {recentMatches.length > DEFAULT_VISIBLE_MATCHES && (
                    <button
                      onClick={() => setShowAllMatches((value) => !value)}
                      style={{
                        alignSelf: "center",
                        marginTop: 8,
                        padding: "9px 16px",
                        border: "1px solid var(--color-line)",
                        borderRadius: 10,
                        background: "var(--color-paper)",
                        color: "var(--color-ink)",
                        cursor: "pointer",
                        fontFamily: "var(--font-ui)",
                        fontWeight: 650,
                      }}
                    >
                      {hasHiddenMatches
                        ? `View all ${recentMatches.length} matches`
                        : `Show latest ${DEFAULT_VISIBLE_MATCHES}`}
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

const surfaceStyle: CSSProperties = {
  padding: 24,
  background:
    "linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-sunk) 100%)",
  border: "1px solid var(--color-line)",
};

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        alignItems: "center",
        marginBottom: 18,
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            color: "var(--color-ink)",
            fontSize: 20,
            fontWeight: 750,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            color: "var(--color-ink-muted)",
            fontSize: 13,
          }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "positive" | "negative";
}) {
  const color =
    tone === "positive"
      ? "var(--color-sage-500)"
      : tone === "negative"
        ? "var(--color-coral-500)"
        : "var(--color-ink)";

  return (
    <div
      style={{
        padding: 16,
        border: "1px solid var(--color-line)",
        borderRadius: 10,
        background: "var(--color-paper)",
      }}
    >
      <div style={{ color: "var(--color-ink-muted)", fontSize: 13 }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          color,
          fontSize: 28,
          fontWeight: 760,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MatchRow({ match }: { match: RankedMatchDetail }) {
  const won = match.result === "win";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "76px 1fr 96px 118px 108px 120px",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        border: "1px solid var(--color-line)",
        borderRadius: 10,
        background: "var(--color-paper)",
        color: "var(--color-ink)",
      }}
    >
      <span
        style={{
          color: won ? "var(--color-sage-500)" : "var(--color-coral-500)",
          fontWeight: 750,
        }}
      >
        {won ? "Win" : "Loss"}
      </span>
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: 650,
        }}
      >
        vs {match.opponentName}
      </span>
      <span style={mutedNumberStyle}>{formatEloChange(match.eloChange)}</span>
      <span style={mutedNumberStyle}>
        {match.eloBefore} {"->"} {match.eloAfter}
      </span>
      <span style={mutedNumberStyle}>{match.mistakes} mistakes</span>
      <span style={{ color: "var(--color-ink-muted)", fontSize: 12 }}>
        {formatDate(match.completedAt)}
      </span>
    </div>
  );
}

const mutedNumberStyle: CSSProperties = {
  color: "var(--color-ink-muted)",
  fontVariantNumeric: "tabular-nums",
};

function formatEloChange(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
