import assert from "assert";
import {
  findClosestPlayer,
  findEligibleOpponent,
  findInsertionIndex,
  processRatedQueueJoin,
  processRatedQueueTimeout,
  type RatedQueueEntry,
  type RatedQueueOperations,
} from "../src/elo/ratedQueueLogic.js";

const players: RatedQueueEntry[] = [
  { accountId: "player-100", elo: 100 },
  { accountId: "player-250", elo: 250 },
  { accountId: "player-400", elo: 400 },
];

describe("findInsertionIndex", () => {
  it("returns 0 for an empty queue", () => {
    assert.strictEqual(findInsertionIndex([], 300), 0);
  });

  it("finds the beginning of the queue", () => {
    assert.strictEqual(findInsertionIndex(players, 50), 0);
  });

  it("finds a position in the middle of the queue", () => {
    assert.strictEqual(findInsertionIndex(players, 300), 2);
  });

  it("finds the end of the queue", () => {
    assert.strictEqual(findInsertionIndex(players, 500), 3);
  });
});

describe("findClosestPlayer", () => {
  it("returns undefined for an empty queue", () => {
    assert.strictEqual(findClosestPlayer([], 300), undefined);
  });

  it("selects the player before the insertion index when closer", () => {
    assert.strictEqual(
      findClosestPlayer(players, 300)?.accountId,
      "player-250",
    );
  });

  it("selects the player after the insertion index when closer", () => {
    assert.strictEqual(
      findClosestPlayer(players, 380)?.accountId,
      "player-400",
    );
  });

  it("selects the player before when both players are equally close", () => {
    assert.strictEqual(
      findClosestPlayer(players, 325)?.accountId,
      "player-250",
    );
  });
});

describe("findEligibleOpponent", () => {
  it("returns an opponent when the ELO difference is below 200", () => {
    const queue: RatedQueueEntry[] = [{ accountId: "opponent", elo: 350 }];

    assert.strictEqual(findEligibleOpponent(queue, 500)?.accountId, "opponent");
  });

  it("returns an opponent when the ELO difference is exactly 200", () => {
    const queue: RatedQueueEntry[] = [{ accountId: "opponent", elo: 300 }];

    assert.strictEqual(findEligibleOpponent(queue, 500)?.accountId, "opponent");
  });

  it("returns undefined when the ELO difference is above 200", () => {
    const queue: RatedQueueEntry[] = [{ accountId: "opponent", elo: 299 }];

    assert.strictEqual(findEligibleOpponent(queue, 500), undefined);
  });

  it("returns undefined for an empty queue", () => {
    assert.strictEqual(findEligibleOpponent([], 500), undefined);
  });
});

/*
Records what the queue was asked to do. claimPlayer answers true unless the
account is listed in `lost`, which stands in for another matchmaker having
claimed that player first.
*/
function trackOperations(
  waitingList: RatedQueueEntry[],
  playerElo: number,
  options: { lost?: string[]; canMatch?: (accountId: string) => boolean } = {},
) {
  const added: string[] = [];
  const claimed: string[] = [];
  const lost = new Set(options.lost ?? []);
  let eloRequested = false;

  const operations: RatedQueueOperations = {
    getWaitingList: async () => waitingList,
    getPlayerElo: async () => {
      eloRequested = true;
      return playerElo;
    },
    addPlayer: async (accountId) => {
      added.push(accountId);
    },
    claimPlayer: async (accountId) => {
      claimed.push(accountId);
      return !lost.has(accountId);
    },
    canMatch: options.canMatch,
  };

  return {
    operations,
    added,
    claimed,
    eloRequested: () => eloRequested,
  };
}

describe("processRatedQueueJoin", () => {
  it("claims the opponent when an eligible match is found", async () => {
    const t = trackOperations([{ accountId: "opponent", elo: 350 }], 500);

    const result = await processRatedQueueJoin("new-player", t.operations);

    assert.strictEqual(result.status, "matched");

    if (result.status === "matched") {
      assert.strictEqual(result.opponent.accountId, "opponent");
    }

    assert.deepStrictEqual(t.claimed, ["opponent"]);
    assert.deepStrictEqual(t.added, []);
  });

  it("adds the player when no eligible opponent is found", async () => {
    const t = trackOperations([{ accountId: "opponent", elo: 299 }], 500);

    const result = await processRatedQueueJoin("new-player", t.operations);

    assert.deepStrictEqual(result, { status: "queued" });
    assert.deepStrictEqual(t.added, ["new-player"]);
    assert.deepStrictEqual(t.claimed, []);
  });

  it("does not add or match a player who is already queued", async () => {
    const t = trackOperations([{ accountId: "new-player", elo: 500 }], 500);

    const result = await processRatedQueueJoin("new-player", t.operations);

    assert.deepStrictEqual(result, { status: "queued" });
    assert.strictEqual(t.eloRequested(), false);
    assert.deepStrictEqual(t.added, []);
    assert.deepStrictEqual(t.claimed, []);
  });

  it("falls back to the next opponent when a claim is lost", async () => {
    const t = trackOperations(
      [
        { accountId: "free-opponent", elo: 420 },
        { accountId: "taken-opponent", elo: 480 },
      ],
      500,
      { lost: ["taken-opponent"] },
    );

    const result = await processRatedQueueJoin("new-player", t.operations);

    assert.strictEqual(result.status, "matched");

    if (result.status === "matched") {
      assert.strictEqual(result.opponent.accountId, "free-opponent");
    }

    assert.deepStrictEqual(t.claimed, ["taken-opponent", "free-opponent"]);
    assert.deepStrictEqual(t.added, []);
  });

  it("queues the player when every eligible claim is lost", async () => {
    const t = trackOperations(
      [{ accountId: "taken-opponent", elo: 480 }],
      500,
      {
        lost: ["taken-opponent"],
      },
    );

    const result = await processRatedQueueJoin("new-player", t.operations);

    assert.deepStrictEqual(result, { status: "queued" });
    assert.deepStrictEqual(t.added, ["new-player"]);
  });

  it("skips queued players with no live client", async () => {
    const t = trackOperations(
      [
        { accountId: "connected", elo: 420 },
        { accountId: "disconnected", elo: 490 },
      ],
      500,
      { canMatch: (accountId) => accountId === "connected" },
    );

    const result = await processRatedQueueJoin("new-player", t.operations);

    assert.strictEqual(result.status, "matched");

    if (result.status === "matched") {
      assert.strictEqual(result.opponent.accountId, "connected");
    }

    assert.deepStrictEqual(t.claimed, ["connected"]);
  });
});

describe("processRatedQueueTimeout", () => {
  it("matches the closest player without the 200-point limit", async () => {
    const t = trackOperations(
      [
        { accountId: "waiting-player", elo: 100 },
        { accountId: "closest-opponent", elo: 500 },
        { accountId: "farther-opponent", elo: 800 },
      ],
      100,
    );

    const result = await processRatedQueueTimeout(
      "waiting-player",
      t.operations,
    );

    assert.strictEqual(result.status, "matched");

    if (result.status === "matched") {
      assert.strictEqual(result.opponent.accountId, "closest-opponent");
    }

    // Opponent first: losing our own row after theirs is what tells us we
    // were matched elsewhere.
    assert.deepStrictEqual(t.claimed, ["closest-opponent", "waiting-player"]);
  });

  it("returns waiting-alone when no other player is queued", async () => {
    const t = trackOperations([{ accountId: "waiting-player", elo: 100 }], 100);

    const result = await processRatedQueueTimeout(
      "waiting-player",
      t.operations,
    );

    assert.deepStrictEqual(result, { status: "waiting-alone" });
    assert.deepStrictEqual(t.claimed, []);
  });

  it("returns not-queued when the player has already left", async () => {
    const t = trackOperations([{ accountId: "someone-else", elo: 300 }], 100);

    const result = await processRatedQueueTimeout(
      "waiting-player",
      t.operations,
    );

    assert.deepStrictEqual(result, { status: "not-queued" });
    assert.strictEqual(t.eloRequested(), false);
    assert.deepStrictEqual(t.claimed, []);
  });

  it("returns waiting-alone when every opponent claim is lost", async () => {
    const t = trackOperations(
      [
        { accountId: "waiting-player", elo: 100 },
        { accountId: "taken-opponent", elo: 500 },
      ],
      100,
      { lost: ["taken-opponent"] },
    );

    const result = await processRatedQueueTimeout(
      "waiting-player",
      t.operations,
    );

    assert.deepStrictEqual(result, { status: "waiting-alone" });
    assert.deepStrictEqual(t.added, []);
  });

  it("requeues the opponent when our own row was already claimed", async () => {
    const t = trackOperations(
      [
        { accountId: "waiting-player", elo: 100 },
        { accountId: "opponent", elo: 500 },
      ],
      100,
      { lost: ["waiting-player"] },
    );

    const result = await processRatedQueueTimeout(
      "waiting-player",
      t.operations,
    );

    assert.deepStrictEqual(result, { status: "not-queued" });
    assert.deepStrictEqual(t.added, ["opponent"]);
  });
});
