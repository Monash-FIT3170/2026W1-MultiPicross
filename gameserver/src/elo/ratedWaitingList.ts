// Rated matchmaking queue, backed by rated_waiting_list and the most recent
// rating in player_elo_history. api owns the schema and the migrations.

import { sql } from "../db/client.js";
import {
  processRatedQueueJoin,
  processRatedQueueTimeout,
  type JoinRatedQueueResult,
  type QueueTimeoutResult,
  type RatedQueueEntry,
  type RatedQueueOperations,
} from "./ratedQueueLogic.js";

/** Rating for a player who has never had one recorded. */
export const DEFAULT_ELO = 100;

/** Filters out queued accounts with no live client in the calling room. */
export type MatchableCheck = (accountId: string) => boolean;

export async function getPlayerElo(accountId: string): Promise<number> {
  const rows = await sql<{ elo: number }[]>`
    SELECT elo
    FROM player_elo_history
    WHERE account_id = ${accountId}
    ORDER BY recorded_at DESC
    LIMIT 1
  `;

  return rows[0]?.elo ?? DEFAULT_ELO;
}

/*
One query rather than a rating lookup per queued player. The lateral join
takes each player's latest rating and the sort happens in the database.
*/
export async function getRatedWaitingList(
  boardSize: number,
): Promise<RatedQueueEntry[]> {
  return sql<RatedQueueEntry[]>`
    SELECT
      waiting.account_id AS "accountId",
      COALESCE(latest.elo, ${DEFAULT_ELO}::int) AS elo
    FROM rated_waiting_list waiting
    LEFT JOIN LATERAL (
      SELECT elo
      FROM player_elo_history
      WHERE account_id = waiting.account_id
      ORDER BY recorded_at DESC
      LIMIT 1
    ) latest ON TRUE
    WHERE waiting.board_size = ${boardSize}
    ORDER BY elo
  `;
}

/*
addToRatedWaitingList queues a player for one board size. The same account can
wait in separate board-size queues, but only once per size.
*/
export async function addToRatedWaitingList(
  accountId: string,
  boardSize: number,
): Promise<void> {
  await sql`
    INSERT INTO rated_waiting_list (account_id, board_size)
    VALUES (${accountId}, ${boardSize})
    ON CONFLICT (account_id, board_size) DO NOTHING
  `;
}

/*
claimFromRatedWaitingList removes a player and reports whether this caller was
the one that removed them. Two matchmakers racing for the same opponent
therefore cannot both believe they won them.
*/
export async function claimFromRatedWaitingList(
  accountId: string,
  boardSize: number,
): Promise<boolean> {
  const removed = await sql`
    DELETE FROM rated_waiting_list
    WHERE account_id = ${accountId} AND board_size = ${boardSize}
    RETURNING account_id
  `;

  return removed.length > 0;
}

/** Removes a player who left the queue, ignoring whether a row was there. */
export async function removeFromRatedWaitingList(
  accountId: string,
  boardSize?: number,
): Promise<void> {
  if (boardSize === undefined) {
    await sql`
      DELETE FROM rated_waiting_list
      WHERE account_id = ${accountId}
    `;
    return;
  }

  await claimFromRatedWaitingList(accountId, boardSize);
}

function queueOperations(
  boardSize: number,
  canMatch?: MatchableCheck,
): RatedQueueOperations {
  return {
    getWaitingList: () => getRatedWaitingList(boardSize),
    getPlayerElo,
    addPlayer: (accountId) => addToRatedWaitingList(accountId, boardSize),
    claimPlayer: (accountId) => claimFromRatedWaitingList(accountId, boardSize),
    canMatch,
  };
}

/*
joinRatedQueue matches a player with the closest eligible opponent, or enters
them into the queue when there is nobody suitable.
*/
export async function joinRatedQueue(
  accountId: string,
  boardSize: number,
  canMatch?: MatchableCheck,
): Promise<JoinRatedQueueResult> {
  return processRatedQueueJoin(accountId, queueOperations(boardSize, canMatch));
}

export async function handleRatedQueueTimeout(
  accountId: string,
  boardSize: number,
  canMatch?: MatchableCheck,
): Promise<QueueTimeoutResult> {
  return processRatedQueueTimeout(
    accountId,
    queueOperations(boardSize, canMatch),
  );
}
