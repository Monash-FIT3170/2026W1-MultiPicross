//Create a sorted list of players waiting to play a game, sorted by their Elo rating
//Players can be added to the waiting list when looking for a game, and removed when matched with another player or leave the waiting list
import { ratedWaitingList, playerEloHistory } from "@api/db/schema.js";
import { db } from "@api/db/client.js";
import { desc, eq } from "drizzle-orm";

type RatedQueueEntry = {
  accountId: string;
  elo: number;
};
/*
getRatedWaitingList() retrieves the current state of the waiting list for the rated game mode.
It returns the list.
*/
export async function getRatedWaitingList() {
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
        const latestRating = await db
          .select({ elo: playerEloHistory.elo })
          .from(playerEloHistory)
          .where(eq(playerEloHistory.accountId, accountId))
          .orderBy(desc(playerEloHistory.recordedAt))
          .limit(1);

        return {
          accountId,
          elo: latestRating[0]?.elo ?? 100,
        };
      },
    ),
  );

  return rankedPlayers.sort((a, b) => a.elo - b.elo);
}

/*
addToRatedWaitingList adds the provided player to the rated waiting list. If the player already
exists in the rated waiting list, they cannot be added again.
*/
export async function addToRatedWaitingList(accountId: string) {
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
removeFromRatedWaitingList removes the given player from the rated waiting list. This will be called
when a match has occurred or when a player leaves the queue.
*/
export async function removeFromRatedWaitingList(accountId: string) {
  await db
    .delete(ratedWaitingList)
    .where(eq(ratedWaitingList.accountId, accountId));
}
