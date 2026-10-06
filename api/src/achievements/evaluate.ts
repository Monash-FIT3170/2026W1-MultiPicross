import { sql } from "drizzle-orm";
import type { db as dbType } from "../db/client.js";
import { accountAchievementProgress, accountAchievements } from "../db/schema.js";
import { ACHIEVEMENTS } from "./definitions.js";

type Tx = Parameters<Parameters<typeof dbType.transaction>[0]>[0];

export interface CompletionContext {
  livesLeft: number;
  elapsedSeconds: number;
  width: number;
  height: number;
}

const MAX_LIVES = 3;
const SPEED_CLEAR_SECONDS = 60;
const LARGE_PUZZLE_MIN_SIDE = 20;

function computeIncrements(ctx: CompletionContext): Record<string, number> {
  const increments: Record<string, number> = { sp_completions_count: 1 };
  if (ctx.livesLeft === MAX_LIVES) increments.sp_perfect_clears = 1;
  if (ctx.elapsedSeconds < SPEED_CLEAR_SECONDS) increments.sp_speed_clears = 1;
  if (ctx.width >= LARGE_PUZZLE_MIN_SIDE && ctx.height >= LARGE_PUZZLE_MIN_SIDE) {
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

  const newProgress = new Map<string, number>();
  for (const [statKey, amount] of Object.entries(increments)) {
    const [row] = await tx
      .insert(accountAchievementProgress)
      .values({ accountId, achievementKey: statKey, progress: amount })
      .onConflictDoUpdate({
        target: [
          accountAchievementProgress.accountId,
          accountAchievementProgress.achievementKey,
        ],
        set: {
          progress: sql`${accountAchievementProgress.progress} + ${amount}`,
          updatedAt: new Date(),
        },
      })
      .returning({ progress: accountAchievementProgress.progress });
    newProgress.set(statKey, row.progress);
  }

  const unlocked: string[] = [];
  for (const def of ACHIEVEMENTS) {
    const progress = newProgress.get(def.statKey);
    if (progress === undefined || progress < def.goal) continue;

    const [inserted] = await tx
      .insert(accountAchievements)
      .values({ accountId, achievementKey: def.key })
      .onConflictDoNothing()
      .returning({ key: accountAchievements.achievementKey });

    if (inserted) unlocked.push(def.key);
  }

  return unlocked;
}
