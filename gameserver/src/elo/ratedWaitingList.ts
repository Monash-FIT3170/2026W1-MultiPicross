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
export async function getRatedWaitingList(): Promise<RatedQueueEntry[]> {
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
    ORDER BY elo
  `;
}

/*
addToRatedWaitingList queues a player. account_id is unique, so a player who
is already waiting stays as they are rather than gaining a second row.
*/
export async function addToRatedWaitingList(accountId: string): Promise<void> {
  await sql`
    INSERT INTO rated_waiting_list (account_id)
    VALUES (${accountId})
    ON CONFLICT (account_id) DO NOTHING
  `;
}

/*
claimFromRatedWaitingList removes a player and reports whether this caller was
the one that removed them. Two matchmakers racing for the same opponent
therefore cannot both believe they won them.
*/
export async function claimFromRatedWaitingList(
  accountId: string,
): Promise<boolean> {
  const removed = await sql`
    DELETE FROM rated_waiting_list
    WHERE account_id = ${accountId}
    RETURNING account_id
  `;

  return removed.length > 0;
}

/** Removes a player who left the queue, ignoring whether a row was there. */
export async function removeFromRatedWaitingList(
  accountId: string,
): Promise<void> {
  await claimFromRatedWaitingList(accountId);
}

function queueOperations(canMatch?: MatchableCheck): RatedQueueOperations {
  return {
    getWaitingList: getRatedWaitingList,
    getPlayerElo,
    addPlayer: addToRatedWaitingList,
    claimPlayer: claimFromRatedWaitingList,
    canMatch,
  };
}

/*
joinRatedQueue matches a player with the closest eligible opponent, or enters
them into the queue when there is nobody suitable.
*/
export async function joinRatedQueue(
  accountId: string,
  canMatch?: MatchableCheck,
): Promise<JoinRatedQueueResult> {
  return processRatedQueueJoin(accountId, queueOperations(canMatch));
}

export async function handleRatedQueueTimeout(
  accountId: string,
  canMatch?: MatchableCheck,
): Promise<QueueTimeoutResult> {
  return processRatedQueueTimeout(accountId, queueOperations(canMatch));
}
