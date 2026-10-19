import { useEffect, useState } from "react";
import { apiFetch } from "./client";
import type { IconName } from "../components/ui";

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  category: "singleplayer";
  icon: IconName;
  goal: number;
  statKey: string;
}

export interface MyAchievement {
  key: string;
  progress: number;
  goal: number;
  unlockedAt: string | null;
}

// Definitions only change on deploy, so one fetch per session is enough —
// shared by the unlock toast (Singleplayer.tsx) and the achievements screen
// (Achievements.tsx).
let definitionsCache: AchievementDef[] | null = null;

export function useAchievementDefinitions() {
  const [definitions, setDefinitions] = useState<AchievementDef[] | null>(
    definitionsCache,
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    if (definitionsCache) return;

    let cancelled = false;
    apiFetch("/achievements/definitions")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { achievements: AchievementDef[] };
        if (!cancelled) {
          definitionsCache = body.achievements;
          setDefinitions(body.achievements);
        }
      })
      .catch(() => {
        // Definitions stay null; the toast falls back to a generic label.
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { definitions, error };
}

export function useMyAchievements(enabled: boolean) {
  const [achievements, setAchievements] = useState<MyAchievement[] | null>(
    null,
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    apiFetch("/achievements/mine")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { achievements: MyAchievement[] };
        if (!cancelled) setAchievements(body.achievements);
      })
      .catch(() => {
        // Leave achievements as-is; a transient failure shouldn't wipe an
        // already-loaded list.
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { achievements, error };
}
