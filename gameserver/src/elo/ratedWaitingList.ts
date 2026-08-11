//Create a sorted list of players waiting to play a game, sorted by their Elo rating
//Players can be added to the waiting list when looking for a game, and removed when matched with another player or leave the waiting list
import { ratedWaitingList, playerElo } from "../../../api/src/db/schema.js";
import { db } from "../../../api/src/db/client.js";
import { eq } from "drizzle-orm";

/*
getRatedWaitingList() retrieves the current state of the waiting list for the rated game mode.
It returns the list.
*/
export async function getRatedWaitingList() {
	return await db
		.select({
			accountId: ratedWaitingList.accountId,
			elo: playerElo.elo,
		})
		.from(ratedWaitingList)
		.innerJoin(playerElo, eq(ratedWaitingList.accountId, playerElo.accountId))
		.orderBy(playerElo.elo);
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

	if (existingPlayer) {
		return;
	}

	await db.insert(ratedWaitingList).values({ accountId });
}

/*
removeFromRatedWaitingList removes the given player from the rated waiting list. This will be called
when a match has occurred or when a player leaves the queue.
*/
export async function removeFromRatedWaitingList(accountId: string) {
	await db.delete(ratedWaitingList).where(eq(ratedWaitingList.accountId, accountId));
}

