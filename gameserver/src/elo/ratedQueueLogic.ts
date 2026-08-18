export type RatedQueueEntry = {
  accountId: string;
  elo: number;
};

export type JoinRatedQueueResult =
  | {
      status: "matched";
      opponent: RatedQueueEntry;
    }
  | {
      status: "queued";
    };

export type QueueTimeoutResult =
  | {
      status: "matched";
      opponent: RatedQueueEntry;
    }
  | {
      status: "waiting-alone";
    }
  | {
      status: "not-queued";
    };

export type RatedQueueOperations = {
  getWaitingList: () => Promise<RatedQueueEntry[]>;
  getPlayerElo: (accountId: string) => Promise<number>;
  addPlayer: (accountId: string) => Promise<void>;
  removePlayer: (accountId: string) => Promise<void>;
};

export const MAX_ELO_DIFFERENCE = 200;

export function findInsertionIndex(
  players: RatedQueueEntry[],
  playerElo: number,
): number {
  let low = 0;
  let high = players.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (players[middle].elo < playerElo) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

export function findClosestPlayer(
  players: RatedQueueEntry[],
  playerElo: number,
): RatedQueueEntry | undefined {
  if (players.length === 0) {
    return undefined;
  }

  const insertionIndex = findInsertionIndex(players, playerElo);

  const playerBefore = players[insertionIndex - 1];
  const playerAfter = players[insertionIndex];

  if (!playerBefore) {
    return playerAfter;
  }

  if (!playerAfter) {
    return playerBefore;
  }

  const differenceBefore = Math.abs(playerElo - playerBefore.elo);
  const differenceAfter = Math.abs(playerAfter.elo - playerElo);

  if (differenceBefore <= differenceAfter) {
    return playerBefore;
  }

  return playerAfter;
}

export function findEligibleOpponent(
  players: RatedQueueEntry[],
  playerElo: number,
): RatedQueueEntry | undefined {
  const closestPlayer = findClosestPlayer(players, playerElo);

  if (!closestPlayer) {
    return undefined;
  }

  const eloDifference = Math.abs(playerElo - closestPlayer.elo);

  if (eloDifference <= MAX_ELO_DIFFERENCE) {
    return closestPlayer;
  }

  return undefined;
}

export async function processRatedQueueJoin(
  accountId: string,
  operations: RatedQueueOperations,
): Promise<JoinRatedQueueResult> {
  const waitingList = await operations.getWaitingList();

  const alreadyQueued = waitingList.some(
    (player) => player.accountId === accountId,
  );

  if (alreadyQueued) {
    return { status: "queued" };
  }

  const playerElo = await operations.getPlayerElo(accountId);
  const opponent = findEligibleOpponent(waitingList, playerElo);

  if (opponent) {
    await operations.removePlayer(opponent.accountId);

    return {
      status: "matched",
      opponent,
    };
  }

  await operations.addPlayer(accountId);

  return { status: "queued" };
}

export async function processRatedQueueTimeout(
  accountId: string,
  operations: RatedQueueOperations,
): Promise<QueueTimeoutResult> {
  const waitingList = await operations.getWaitingList();

  const playerIsQueued = waitingList.some(
    (player) => player.accountId === accountId,
  );

  if (!playerIsQueued) {
    return { status: "not-queued" };
  }

  const otherPlayers = waitingList.filter(
    (player) => player.accountId !== accountId,
  );

  if (otherPlayers.length === 0) {
    return { status: "waiting-alone" };
  }

  const playerElo = await operations.getPlayerElo(accountId);
  const opponent = findClosestPlayer(otherPlayers, playerElo);

  if (!opponent) {
    return { status: "waiting-alone" };
  }

  await Promise.all([
    operations.removePlayer(accountId),
    operations.removePlayer(opponent.accountId),
  ]);

  return {
    status: "matched",
    opponent,
  };
}
