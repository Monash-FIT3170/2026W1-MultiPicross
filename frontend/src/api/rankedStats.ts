import { useEffect, useState } from "react";
import { apiFetch } from "./client";

export interface RankedStats {
  displayName: string;
  elo: number;
  wins: number;
  losses: number;
  totalGames: number;
  winRate: number;
  rank: number;
  averageMistakes?: number;
  totalMistakes?: number;
  lastEloChange?: number;
  recentMatches?: RankedMatchDetail[];
}

export interface RankedMatchDetail {
  id: string;
  opponentName: string;
  result: "win" | "loss";
  eloBefore: number;
  eloAfter: number;
  eloChange: number;
  mistakes: number;
  opponentMistakes: number;
  completedAt: string;
}

export function useRankedLeaderboard() {
  const [entries, setEntries] = useState<RankedStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    apiFetch("/auth/ranked-leaderboard?limit=10")
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as { entries: RankedStats[] };
        if (!cancelled) setEntries(body.entries);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { entries, loading };
}

export function useMyRankedStats(enabled: boolean) {
  const [fetchedStats, setFetchedStats] = useState<
    RankedStats | null | undefined
  >(undefined);

  const stats = enabled ? (fetchedStats ?? null) : null;
  const loading = enabled && fetchedStats === undefined;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    apiFetch("/auth/ranked-stats/me")
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setFetchedStats(null);
          return;
        }
        const body = (await res.json()) as RankedStats;
        if (!cancelled) setFetchedStats(body);
      })
      .catch(() => {
        if (!cancelled) setFetchedStats(null);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { stats, loading };
}
