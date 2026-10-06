import { sql } from "../db/client.js";

export type MpMode = "unrated" | "public" | "ranked";

export type MpResultRow = {
  accountId: string;
  puzzleId: string;
  mode: MpMode;
  solved: boolean;
  won: boolean;
  elapsedSeconds: number;
  livesLeft: number;
};

export async function recordMpResults(rows: MpResultRow[]): Promise<void> {
  if (rows.length === 0) return;
  await sql`
    INSERT INTO mp_results ${sql(
      rows.map((r) => ({
        account_id: r.accountId,
        puzzle_id: r.puzzleId,
        mode: r.mode,
        solved: r.solved,
        won: r.won,
        elapsed_seconds: r.elapsedSeconds,
        lives_left: r.livesLeft,
      })),
    )}
  `;
}
