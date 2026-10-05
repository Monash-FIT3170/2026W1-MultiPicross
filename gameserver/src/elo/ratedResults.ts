import { sql } from "../db/client.js";
import { calculateWinningEloGain } from "./calculateWinningElo.js";
import { calculateLoosingEloGain } from "./calculateLoosingElo.js";
import { getPlayerElo } from "./ratedWaitingList.js";

export type RankedResultInput = {
  winnerAccountId: string;
  loserAccountId: string;
  winnerMistakes: number;
  loserMistakes: number;
  boardSize: number;
};

const ELO_MULTIPLIER_BY_BOARD_SIZE = new Map<number, number>([
  [5, 0.5],
  [10, 0.8],
  [15, 1],
  [20, 1.5],
]);

export function eloMultiplierForBoardSize(boardSize: number): number {
  return ELO_MULTIPLIER_BY_BOARD_SIZE.get(boardSize) ?? 1;
}

export async function recordRankedResult({
  winnerAccountId,
  loserAccountId,
  winnerMistakes,
  loserMistakes,
  boardSize,
}: RankedResultInput): Promise<void> {
  const [winnerElo, loserElo] = await Promise.all([
    getPlayerElo(winnerAccountId),
    getPlayerElo(loserAccountId),
  ]);

  const baseWinnerGain = calculateWinningEloGain({
    winnerElo,
    opponentElo: loserElo,
    winnerMistakes,
    opponentMistakes: loserMistakes,
  });
  const baseLoserLoss = calculateLoosingEloGain({
    loosingElo: loserElo,
    opponentElo: winnerElo,
    loosingMistakes: loserMistakes,
    opponentMistakes: winnerMistakes,
  });
  const eloMultiplier = eloMultiplierForBoardSize(boardSize);
  const eloMultiplierPercent = Math.round(eloMultiplier * 100);
  const winnerGain = Math.round(baseWinnerGain * eloMultiplier);
  const loserLoss = Math.round(baseLoserLoss * eloMultiplier);
  const winnerEloAfter = winnerElo + winnerGain;
  const loserEloAfter = Math.max(0, loserElo - loserLoss);

  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO player_elo_history (account_id, elo)
      VALUES (${winnerAccountId}, ${winnerEloAfter})
    `;
    await transaction`
      INSERT INTO player_elo_history (account_id, elo)
      VALUES (${loserAccountId}, ${loserEloAfter})
    `;
    await transaction`
      INSERT INTO ranked_match_results (
        winner_account_id,
        loser_account_id,
        winner_elo_before,
        winner_elo_after,
        loser_elo_before,
        loser_elo_after,
        winner_mistakes,
        loser_mistakes,
        board_size,
        elo_multiplier_percent
      )
      VALUES (
        ${winnerAccountId},
        ${loserAccountId},
        ${winnerElo},
        ${winnerEloAfter},
        ${loserElo},
        ${loserEloAfter},
        ${winnerMistakes},
        ${loserMistakes},
        ${boardSize},
        ${eloMultiplierPercent}
      )
    `;
  });
}
