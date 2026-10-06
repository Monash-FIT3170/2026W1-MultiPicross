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
// (Statistics.tsx).
let definitionsCache: AchievementDef[] | null = null;

export function useAchievementDefinitions() {
  const [definitions, setDefinitions] = useState<AchievementDef[] | null>(
    definitionsCache,
  );

  useEffect(() => {
    if (definitionsCache) return;

    let cancelled = false;
    apiFetch("/achievements/definitions")
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as { achievements: AchievementDef[] };
        if (!cancelled) {
          definitionsCache = body.achievements;
          setDefinitions(body.achievements);
        }
      })
      .catch(() => {
        /* leave null; callers treat missing defs as "unknown achievement" */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { definitions };
}

export function useMyAchievements(enabled: boolean) {
  const [achievements, setAchievements] = useState<MyAchievement[] | null>(
    null,
  );

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    apiFetch("/achievements/mine")
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as { achievements: MyAchievement[] };
        if (!cancelled) setAchievements(body.achievements);
      })
      .catch(() => {
        // Leave achievements as-is; a transient failure shouldn't wipe an
        // already-loaded list.
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { achievements };
}
