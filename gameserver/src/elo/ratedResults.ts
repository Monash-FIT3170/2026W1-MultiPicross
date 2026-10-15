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

export async function getRankedRatingHistory(
  accountId: string,
  limit = 15,
): Promise<number[]> {
  const rows = await sql`
    SELECT elo
    FROM player_elo_history
    WHERE account_id = ${accountId}
    ORDER BY recorded_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => Number(row.elo)).reverse();
}

const ELO_MULTIPLIER_BY_BOARD_SIZE = new Map<number, number>([
  [5, 0.5],
  [10, 0.8],
  [15, 1],
  [20, 1.5],
]);

export function eloMultiplierForBoardSize(boardSize: number): number {
  return ELO_MULTIPLIER_BY_BOARD_SIZE.get(boardSize) ?? 1;
}

export type RankedResult = {
  winnerAccountId: string;
  loserAccountId: string;

  winnerEloBefore: number;
  winnerEloAfter: number;
  winnerEloChange: number;

  loserEloBefore: number;
  loserEloAfter: number;
  loserEloChange: number;

  winnerRatingHistory: number[];
  loserRatingHistory: number[];
};

export async function recordRankedResult({
  winnerAccountId,
  loserAccountId,
  winnerMistakes,
  loserMistakes,
  boardSize,
}: RankedResultInput): Promise<RankedResult> {
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

  const [winnerRatingHistory, loserRatingHistory] = await Promise.all([
    getRankedRatingHistory(winnerAccountId),
    getRankedRatingHistory(loserAccountId),
  ]);


  return {
    winnerAccountId,
    loserAccountId,

    winnerEloBefore: winnerElo,
    winnerEloAfter,
    winnerEloChange: winnerGain,

    loserEloBefore: loserElo,
    loserEloAfter: loserEloAfter,
    loserEloChange: -loserLoss,

    winnerRatingHistory,
    loserRatingHistory,
  };
}

export type DoubleEliminationResult = {
  playerOneAccountId: string;
  playerTwoAccountId: string;

  playerOneEloBefore: number;
  playerOneEloAfter: number;
  playerOneEloChange: number;
  playerOneRatingHistory: number[];

  playerTwoEloBefore: number;
  playerTwoEloAfter: number;
  playerTwoEloChange: number;
  playerTwoRatingHistory: number[];
};

export async function recordDoubleEliminationResult({
  playerOneAccountId,
  playerTwoAccountId,
  playerOneMistakes,
  playerTwoMistakes,
}: {
  playerOneAccountId: string;
  playerTwoAccountId: string;
  playerOneMistakes: number;
  playerTwoMistakes: number;
}): Promise<DoubleEliminationResult> {
  const [playerOneElo, playerTwoElo] = await Promise.all([
    getPlayerElo(playerOneAccountId),
    getPlayerElo(playerTwoAccountId),
  ]);

  const playerOneLoss = calculateLoosingEloGain({
    loosingElo: playerOneElo,
    opponentElo: playerTwoElo,
    loosingMistakes: playerOneMistakes,
    opponentMistakes: playerTwoMistakes,
  });

  const playerTwoLoss = calculateLoosingEloGain({
    loosingElo: playerTwoElo,
    opponentElo: playerOneElo,
    loosingMistakes: playerTwoMistakes,
    opponentMistakes: playerOneMistakes,
  });

  const playerOneEloAfter = Math.max(0, playerOneElo - playerOneLoss);
  const playerTwoEloAfter = Math.max(0, playerTwoElo - playerTwoLoss);

  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO player_elo_history (account_id, elo)
      VALUES (${playerOneAccountId}, ${playerOneEloAfter})
    `;

    await transaction`
      INSERT INTO player_elo_history (account_id, elo)
      VALUES (${playerTwoAccountId}, ${playerTwoEloAfter})
    `;
  });

  const [playerOneRatingHistory, playerTwoRatingHistory] = await Promise.all([
    getRankedRatingHistory(playerOneAccountId),
    getRankedRatingHistory(playerTwoAccountId),
  ]);

  return {
    playerOneAccountId,
    playerTwoAccountId,

    playerOneEloBefore: playerOneElo,
    playerOneEloAfter,
    playerOneEloChange: playerOneEloAfter - playerOneElo,
    playerOneRatingHistory,

    playerTwoEloBefore: playerTwoElo,
    playerTwoEloAfter,
    playerTwoEloChange: playerTwoEloAfter - playerTwoElo,
    playerTwoRatingHistory,
  };
}
