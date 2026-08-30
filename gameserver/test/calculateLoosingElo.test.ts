import { describe, it } from "node:test";
import assert from "assert";
import {
  calculateLooseMistakeModifier,
  calculateLoosingEloGain,
} from "../src/elo/calculateLoosingElo.js";

describe("calculateLooseMistakeModifier", () => {
  it("returns +5 when loser has 3 fewer mistakes", () => {
    assert.strictEqual(calculateLooseMistakeModifier(0, 3), 5);
  });

  it("returns +5 when loser has 2 fewer mistakes", () => {
    assert.strictEqual(calculateLooseMistakeModifier(1, 3), 5);
  });

  it("returns +3 when loser has 1 fewer mistake", () => {
    assert.strictEqual(calculateLooseMistakeModifier(1, 2), 3);
  });

  it("returns 0 when both players have the same mistakes", () => {
    assert.strictEqual(calculateLooseMistakeModifier(2, 2), 0);
  });

  it("returns -1 when loser has 1 more mistake", () => {
    assert.strictEqual(calculateLooseMistakeModifier(2, 1), -1);
  });

  it("returns -2 when loser has 2 more mistakes", () => {
    assert.strictEqual(calculateLooseMistakeModifier(2, 0), -2);
  });

  it("returns -5 when loser has 3 more mistakes", () => {
    assert.strictEqual(calculateLooseMistakeModifier(3, 0), -5);
  });
});

describe("calculateLoosingEloGain", () => {
  it("returns the base loss when ELO and mistakes are equal", () => {
    assert.strictEqual(
      calculateLoosingEloGain({
        loosingElo: 100,
        opponentElo: 100,
        loosingMistakes: 2,
        opponentMistakes: 2,
      }),
      20,
    );
  });

  it("applies the positive mistake modifier", () => {
    assert.strictEqual(
      calculateLoosingEloGain({
        loosingElo: 100,
        opponentElo: 100,
        loosingMistakes: 0,
        opponentMistakes: 3,
      }),
      25,
    );
  });

  it("applies the negative mistake modifier", () => {
    assert.strictEqual(
      calculateLoosingEloGain({
        loosingElo: 100,
        opponentElo: 100,
        loosingMistakes: 3,
        opponentMistakes: 0,
      }),
      15,
    );
  });

  it("scales the loss when losing to a higher-ranked opponent", () => {
    assert.strictEqual(
      calculateLoosingEloGain({
        loosingElo: 100,
        opponentElo: 200,
        loosingMistakes: 2,
        opponentMistakes: 2,
      }),
      23,
    );
  });

  it("uses continuous scaling for a partial 100-point difference", () => {
    assert.strictEqual(
      calculateLoosingEloGain({
        loosingElo: 100,
        opponentElo: 150,
        loosingMistakes: 2,
        opponentMistakes: 2,
      }),
      22,
    );
  });

  it("does not scale the loss against a lower-ranked opponent", () => {
    assert.strictEqual(
      calculateLoosingEloGain({
        loosingElo: 200,
        opponentElo: 100,
        loosingMistakes: 2,
        opponentMistakes: 2,
      }),
      20,
    );
  });

  it("combines mistake modifier, rank scaling, and rounding", () => {
    assert.strictEqual(
      calculateLoosingEloGain({
        loosingElo: 100,
        opponentElo: 200,
        loosingMistakes: 1,
        opponentMistakes: 3,
      }),
      29,
    );
  });
});
