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

describe("processRatedQueueJoin", () => {
  it("removes the opponent when an eligible match is found", async () => {
    const addedPlayers: string[] = [];
    const removedPlayers: string[] = [];

    const operations: RatedQueueOperations = {
      getWaitingList: async () => [{ accountId: "opponent", elo: 350 }],
      getPlayerElo: async () => 500,
      addPlayer: async (accountId) => {
        addedPlayers.push(accountId);
      },
      removePlayer: async (accountId) => {
        removedPlayers.push(accountId);
      },
    };

    const result = await processRatedQueueJoin("new-player", operations);

    assert.strictEqual(result.status, "matched");

    if (result.status === "matched") {
      assert.strictEqual(result.opponent.accountId, "opponent");
    }

    assert.deepStrictEqual(removedPlayers, ["opponent"]);
    assert.deepStrictEqual(addedPlayers, []);
  });

  it("adds the player when no eligible opponent is found", async () => {
    const addedPlayers: string[] = [];
    const removedPlayers: string[] = [];

    const operations: RatedQueueOperations = {
      getWaitingList: async () => [{ accountId: "opponent", elo: 299 }],
      getPlayerElo: async () => 500,
      addPlayer: async (accountId) => {
        addedPlayers.push(accountId);
      },
      removePlayer: async (accountId) => {
        removedPlayers.push(accountId);
      },
    };

    const result = await processRatedQueueJoin("new-player", operations);

    assert.deepStrictEqual(result, { status: "queued" });
    assert.deepStrictEqual(addedPlayers, ["new-player"]);
    assert.deepStrictEqual(removedPlayers, []);
  });

  it("does not add or match a player who is already queued", async () => {
    const addedPlayers: string[] = [];
    const removedPlayers: string[] = [];
    let playerEloRequested = false;

    const operations: RatedQueueOperations = {
      getWaitingList: async () => [{ accountId: "new-player", elo: 500 }],
      getPlayerElo: async () => {
        playerEloRequested = true;
        return 500;
      },
      addPlayer: async (accountId) => {
        addedPlayers.push(accountId);
      },
      removePlayer: async (accountId) => {
        removedPlayers.push(accountId);
      },
    };

    const result = await processRatedQueueJoin("new-player", operations);

    assert.deepStrictEqual(result, { status: "queued" });
    assert.strictEqual(playerEloRequested, false);
    assert.deepStrictEqual(addedPlayers, []);
    assert.deepStrictEqual(removedPlayers, []);
  });
});

describe("processRatedQueueTimeout", () => {
  it("matches the closest player without the 200-point limit", async () => {
    const removedPlayers: string[] = [];

    const operations: RatedQueueOperations = {
      getWaitingList: async () => [
        { accountId: "waiting-player", elo: 100 },
        { accountId: "closest-opponent", elo: 500 },
        { accountId: "farther-opponent", elo: 800 },
      ],
      getPlayerElo: async () => 100,
      addPlayer: async () => {},
      removePlayer: async (accountId) => {
        removedPlayers.push(accountId);
      },
    };

    const result = await processRatedQueueTimeout("waiting-player", operations);

    assert.strictEqual(result.status, "matched");

    if (result.status === "matched") {
      assert.strictEqual(result.opponent.accountId, "closest-opponent");
    }

    assert.deepStrictEqual(removedPlayers, [
      "waiting-player",
      "closest-opponent",
    ]);
  });

  it("returns waiting-alone when no other player is queued", async () => {
    const removedPlayers: string[] = [];

    const operations: RatedQueueOperations = {
      getWaitingList: async () => [{ accountId: "waiting-player", elo: 100 }],
      getPlayerElo: async () => 100,
      addPlayer: async () => {},
      removePlayer: async (accountId) => {
        removedPlayers.push(accountId);
      },
    };

    const result = await processRatedQueueTimeout("waiting-player", operations);

    assert.deepStrictEqual(result, {
      status: "waiting-alone",
    });
    assert.deepStrictEqual(removedPlayers, []);
  });

  it("returns not-queued when the player has already left", async () => {
    let playerEloRequested = false;
    const removedPlayers: string[] = [];

    const operations: RatedQueueOperations = {
      getWaitingList: async () => [{ accountId: "someone-else", elo: 300 }],
      getPlayerElo: async () => {
        playerEloRequested = true;
        return 100;
      },
      addPlayer: async () => {},
      removePlayer: async (accountId) => {
        removedPlayers.push(accountId);
      },
    };

    const result = await processRatedQueueTimeout("waiting-player", operations);

    assert.deepStrictEqual(result, {
      status: "not-queued",
    });
    assert.strictEqual(playerEloRequested, false);
    assert.deepStrictEqual(removedPlayers, []);
  });
});
