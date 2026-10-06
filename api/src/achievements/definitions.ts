// Static achievement catalog. Definitions only change on deploy, so there's
// no DB table for them — evaluate.ts writes progress/unlock rows keyed by
// `key`, and routes.ts serves this list straight to the client.
export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  category: "singleplayer";
  icon:
    | "check"
    | "grid"
    | "trophy"
    | "heart"
    | "clock"
    | "bar-chart";
  /** Progress value (see evaluate.ts) at which this unlocks. */
  goal: number;
  /** Which counter in account_achievement_progress this reads. */
  statKey: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "sp_first_clear",
    name: "First Clear",
    description: "Complete your first singleplayer puzzle.",
    category: "singleplayer",
    icon: "check",
    goal: 1,
    statKey: "sp_completions_count",
  },
  {
    key: "sp_ten_clears",
    name: "Getting the Hang of It",
    description: "Complete 10 singleplayer puzzles.",
    category: "singleplayer",
    icon: "grid",
    goal: 10,
    statKey: "sp_completions_count",
  },
  {
    key: "sp_fifty_clears",
    name: "Nonogram Veteran",
    description: "Complete 50 singleplayer puzzles.",
    category: "singleplayer",
    icon: "trophy",
    goal: 50,
    statKey: "sp_completions_count",
  },
  {
    key: "sp_perfect_clear",
    name: "Flawless",
    description: "Complete a puzzle without losing a life.",
    category: "singleplayer",
    icon: "heart",
    goal: 1,
    statKey: "sp_perfect_clears",
  },
  {
    key: "sp_speed_clear",
    name: "Quick Draw",
    description: "Complete a puzzle in under 60 seconds.",
    category: "singleplayer",
    icon: "clock",
    goal: 1,
    statKey: "sp_speed_clears",
  },
  {
    key: "sp_large_puzzle",
    name: "Go Big",
    description: "Complete a puzzle sized 20×20 or larger.",
    category: "singleplayer",
    icon: "bar-chart",
    goal: 1,
    statKey: "sp_large_clears",
  },
];

export const ACHIEVEMENTS_BY_KEY = new Map(
  ACHIEVEMENTS.map((a) => [a.key, a]),
);
