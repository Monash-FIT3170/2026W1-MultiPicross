export type GameMode = "1v1" | "1v1v1" | "1v1v1v1" | "2v2";

export interface GameModeConfig {
  maxPlayers: number;
  teamBased: boolean;
  teamCount: number;
}

export const GAME_MODES: Record<GameMode, GameModeConfig> = {
  "1v1": { maxPlayers: 2, teamBased: false, teamCount: 1 },
  "1v1v1": { maxPlayers: 3, teamBased: false, teamCount: 1 },
  "1v1v1v1": { maxPlayers: 4, teamBased: false, teamCount: 1 },
  "2v2": { maxPlayers: 4, teamBased: true, teamCount: 2 },
};

export const DEFAULT_GAME_MODE: GameMode = "1v1";

export function isGameMode(value: unknown): value is GameMode {
  return typeof value === "string" && value in GAME_MODES;
}
