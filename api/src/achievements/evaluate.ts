import { sql } from "drizzle-orm";
import type { db as dbType } from "../db/client.js";
import {
  accountAchievementProgress,
  accountAchievements,
} from "../db/schema.js";
import { ACHIEVEMENTS } from "./definitions.js";

type Tx = Parameters<Parameters<typeof dbType.transaction>[0]>[0];

export interface CompletionContext {
  livesLeft: number;
  elapsedSeconds: number;
  /** Wall-clock seconds since the game was started, pauses included. */
  wallSeconds: number;
  width: number;
  height: number;
}

const MAX_LIVES = 3;
const SPEED_CLEAR_SECONDS = 60;
const LARGE_PUZZLE_MIN_SIDE = 20;

function computeIncrements(ctx: CompletionContext): Record<string, number> {
  const increments: Record<string, number> = { sp_completions_count: 1 };
  if (ctx.livesLeft === MAX_LIVES) increments.sp_perfect_clears = 1;
  // The in-game timer stops while the client reports the game as paused, so
  // on its own it can be gamed by pausing between moves. Also require the
  // wall-clock time since the game started to be under the threshold.
  if (
    ctx.elapsedSeconds < SPEED_CLEAR_SECONDS &&
    ctx.wallSeconds < SPEED_CLEAR_SECONDS
  ) {
    increments.sp_speed_clears = 1;
  }
  if (
    ctx.width >= LARGE_PUZZLE_MIN_SIDE &&
    ctx.height >= LARGE_PUZZLE_MIN_SIDE
  ) {
    increments.sp_large_clears = 1;
  }
  return increments;
}

// Bumps the relevant progress counters for a just-completed singleplayer
// puzzle and unlocks any achievement that just crossed its goal. Must run in
// the same transaction as the sp_completions write that finished the game,
// so a crash between the two can never award progress for a game that didn't
// actually complete.
export async function evaluateSingleplayerCompletion(
  tx: Tx,
  accountId: string,
  ctx: CompletionContext,
): Promise<string[]> {
  const increments = computeIncrements(ctx);

  // One multi-row upsert for every bumped counter instead of a round trip per
  // stat.
  const progressRows = await tx
    .insert(accountAchievementProgress)
    .values(
      Object.entries(increments).map(([statKey, amount]) => ({
        accountId,
        achievementKey: statKey,
        progress: amount,
      })),
    )
    .onConflictDoUpdate({
      target: [
        accountAchievementProgress.accountId,
        accountAchievementProgress.achievementKey,
      ],
      set: {
        progress: sql`${accountAchievementProgress.progress} + excluded.progress`,
        updatedAt: new Date(),
      },
    })
    .returning({
      statKey: accountAchievementProgress.achievementKey,
      progress: accountAchievementProgress.progress,
    });
  const newProgress = new Map(progressRows.map((r) => [r.statKey, r.progress]));

  const eligible = ACHIEVEMENTS.filter((def) => {
    const progress = newProgress.get(def.statKey);
    return progress !== undefined && progress >= def.goal;
  }).map((def) => def.key);
  if (eligible.length === 0) return [];

  // ON CONFLICT DO NOTHING returns only the rows actually inserted, i.e. the
  // achievements unlocked by this completion.
  const inserted = await tx
    .insert(accountAchievements)
    .values(eligible.map((achievementKey) => ({ accountId, achievementKey })))
    .onConflictDoNothing()
    .returning({ key: accountAchievements.achievementKey });
  const insertedKeys = new Set(inserted.map((r) => r.key));

  // Keep catalog order for the client's toast queue.
  return eligible.filter((key) => insertedKeys.has(key));
}
