import { sql } from "../db/client.js";
import { calculateWinningEloGain } from "./calculateWinningElo.js";
import { calculateLoosingEloGain } from "./calculateLoosingElo.js";
import { getPlayerElo } from "./ratedWaitingList.js";

export type RankedResultInput = {
  winnerAccountId: string;
  loserAccountId: string;
  winnerMistakes: number;
  loserMistakes: number;
};

export async function recordRankedResult({
  winnerAccountId,
  loserAccountId,
  winnerMistakes,
  loserMistakes,
}: RankedResultInput): Promise<void> {
  const [winnerElo, loserElo] = await Promise.all([
    getPlayerElo(winnerAccountId),
    getPlayerElo(loserAccountId),
  ]);

  const winnerGain = calculateWinningEloGain({
    winnerElo,
    opponentElo: loserElo,
    winnerMistakes,
    opponentMistakes: loserMistakes,
  });
  const loserLoss = calculateLoosingEloGain({
    loosingElo: loserElo,
    opponentElo: winnerElo,
    loosingMistakes: loserMistakes,
    opponentMistakes: winnerMistakes,
  });
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
        loser_mistakes
      )
      VALUES (
        ${winnerAccountId},
        ${loserAccountId},
        ${winnerElo},
        ${winnerEloAfter},
        ${loserElo},
        ${loserEloAfter},
        ${winnerMistakes},
        ${loserMistakes}
      )
    `;
  });
}
