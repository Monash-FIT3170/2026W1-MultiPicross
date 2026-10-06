import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { accountAchievementProgress, accountAchievements } from "../db/schema.js";
import { requireAuth } from "../auth/middleware.js";
import { ACHIEVEMENTS } from "./definitions.js";

const achievements = new Hono();

achievements.get(
  "/definitions",
  describeRoute({
    tags: ["Achievements"],
    summary: "List all achievement definitions",
    responses: {
      200: { description: "Achievement definitions" },
    },
  }),
  (c) => c.json({ achievements: ACHIEVEMENTS }),
);

achievements.get(
  "/mine",
  requireAuth,
  describeRoute({
    tags: ["Achievements"],
    summary: "Get the caller's achievement progress and unlocks",
    responses: {
      200: { description: "Per-achievement progress and unlock state" },
      401: { description: "Not authenticated" },
    },
  }),
  async (c) => {
    const { sub: accountId } = c.get("jwtPayload") as { sub: string };

    const [progressRows, unlockRows] = await Promise.all([
      db
        .select({
          statKey: accountAchievementProgress.achievementKey,
          progress: accountAchievementProgress.progress,
        })
        .from(accountAchievementProgress)
        .where(eq(accountAchievementProgress.accountId, accountId)),
      db
        .select({
          key: accountAchievements.achievementKey,
          unlockedAt: accountAchievements.unlockedAt,
        })
        .from(accountAchievements)
        .where(eq(accountAchievements.accountId, accountId)),
    ]);

    const progressByStat = new Map(progressRows.map((r) => [r.statKey, r.progress]));
    const unlockedAtByKey = new Map(unlockRows.map((r) => [r.key, r.unlockedAt]));

    return c.json({
      achievements: ACHIEVEMENTS.map((def) => ({
        key: def.key,
        progress: Math.min(progressByStat.get(def.statKey) ?? 0, def.goal),
        goal: def.goal,
        unlockedAt: unlockedAtByKey.get(def.key) ?? null,
      })),
    });
  },
);

export default achievements;
