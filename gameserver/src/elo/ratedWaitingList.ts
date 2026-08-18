// Create a sorted list of players waiting to play a game, sorted by their ELO rating.
// Players can be added when looking for a game and removed when matched or leaving.

import { ratedWaitingList, playerEloHistory } from "@api/db/schema.js";
import { db } from "@api/db/client.js";
import { desc, eq } from "drizzle-orm";
import {
  processRatedQueueJoin,
  type JoinRatedQueueResult,
  type RatedQueueEntry,
} from "./ratedQueueLogic.js";

/*
getPlayerElo retrieves the player's latest ELO rating.
A player without an ELO history starts at 100 ELO.
*/
export async function getPlayerElo(accountId: string): Promise<number> {
  const latestRating = await db
    .select({ elo: playerEloHistory.elo })
    .from(playerEloHistory)
    .where(eq(playerEloHistory.accountId, accountId))
    .orderBy(desc(playerEloHistory.recordedAt))
    .limit(1);

  return latestRating[0]?.elo ?? 100;
}

/*
getRatedWaitingList retrieves the current rated waiting list
and returns its players sorted by ELO.
*/
export async function getRatedWaitingList(): Promise<RatedQueueEntry[]> {
  const queuedPlayers = await db
    .select({
      accountId: ratedWaitingList.accountId,
    })
    .from(ratedWaitingList);

  const rankedPlayers = await Promise.all<RatedQueueEntry>(
    queuedPlayers.map(
      async ({
        accountId,
      }: {
        accountId: string;
      }): Promise<RatedQueueEntry> => {
        return {
          accountId,
          elo: await getPlayerElo(accountId),
        };
      },
    ),
  );

  return rankedPlayers.sort((firstPlayer, secondPlayer) => {
    return firstPlayer.elo - secondPlayer.elo;
  });
}

/*
addToRatedWaitingList adds a player to the rated waiting list.
A player who is already waiting will not be added again.
*/
export async function addToRatedWaitingList(accountId: string): Promise<void> {
  const existingPlayer = await db
    .select()
    .from(ratedWaitingList)
    .where(eq(ratedWaitingList.accountId, accountId));

  if (existingPlayer.length > 0) {
    return;
  }

  await db.insert(ratedWaitingList).values({ accountId });
}

/*
removeFromRatedWaitingList removes a player after they are matched
or when they leave the queue.
*/
export async function removeFromRatedWaitingList(
  accountId: string,
): Promise<void> {
  await db
    .delete(ratedWaitingList)
    .where(eq(ratedWaitingList.accountId, accountId));
}

/*
joinRatedQueue attempts to match a player with the closest eligible
opponent. If no eligible opponent exists, the player enters the queue.
*/
export async function joinRatedQueue(
  accountId: string,
): Promise<JoinRatedQueueResult> {
  return processRatedQueueJoin(accountId, {
    getWaitingList: getRatedWaitingList,
    getPlayerElo,
    addPlayer: addToRatedWaitingList,
    removePlayer: removeFromRatedWaitingList,
  });
}
