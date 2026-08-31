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
  /** Removes a player, reporting false if another matchmaker got there first. */
  claimPlayer: (accountId: string) => Promise<boolean>;
  /** Skips queue rows with no live client, e.g. left behind by a crash. */
  canMatch?: (accountId: string) => boolean;
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

function matchableOpponents(
  waitingList: RatedQueueEntry[],
  accountId: string,
  operations: RatedQueueOperations,
): RatedQueueEntry[] {
  return waitingList.filter(
    (player) =>
      player.accountId !== accountId &&
      (operations.canMatch?.(player.accountId) ?? true),
  );
}

/*
Claims the best remaining candidate. A failed claim means another matchmaker
took that player first, so drop them and reconsider instead of giving up.
*/
async function claimBestOpponent(
  candidates: RatedQueueEntry[],
  playerElo: number,
  pick: (
    players: RatedQueueEntry[],
    playerElo: number,
  ) => RatedQueueEntry | undefined,
  operations: RatedQueueOperations,
): Promise<RatedQueueEntry | undefined> {
  const pool = [...candidates];

  while (pool.length > 0) {
    const candidate = pick(pool, playerElo);

    if (!candidate) {
      return undefined;
    }

    if (await operations.claimPlayer(candidate.accountId)) {
      return candidate;
    }

    pool.splice(pool.indexOf(candidate), 1);
  }

  return undefined;
}

/*
processRatedQueueJoin matches a player against the closest eligible opponent,
or enters them into the queue when there is nobody suitable.
*/
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
  const opponent = await claimBestOpponent(
    matchableOpponents(waitingList, accountId, operations),
    playerElo,
    findEligibleOpponent,
    operations,
  );

  if (opponent) {
    return { status: "matched", opponent };
  }

  await operations.addPlayer(accountId);

  return { status: "queued" };
}

/*
processRatedQueueTimeout runs once a player has waited long enough to drop the
Elo limit, so it takes the closest opponent regardless of rating difference.
*/
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

  const candidates = matchableOpponents(waitingList, accountId, operations);

  if (candidates.length === 0) {
    return { status: "waiting-alone" };
  }

  const playerElo = await operations.getPlayerElo(accountId);
  const opponent = await claimBestOpponent(
    candidates,
    playerElo,
    findClosestPlayer,
    operations,
  );

  if (!opponent) {
    return { status: "waiting-alone" };
  }

  /*
  Claim our own row last. Losing it means another matchmaker already matched
  us, so put the opponent back rather than stranding them out of the queue.
  */
  if (!(await operations.claimPlayer(accountId))) {
    await operations.addPlayer(opponent.accountId);

    return { status: "not-queued" };
  }

  return { status: "matched", opponent };
}
