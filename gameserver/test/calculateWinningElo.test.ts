import assert from "assert";
import {
  calculateMistakeModifier,
  calculateWinningEloGain,
} from "../src/elo/calculateWinningElo.js";

describe("calculateMistakeModifier", () => {
  it("returns +5 when winner has 3 fewer mistakes", () => {
    assert.strictEqual(calculateMistakeModifier(0, 3), 5);
  });

  it("returns +3 when winner has 2 fewer mistakes", () => {
    assert.strictEqual(calculateMistakeModifier(1, 3), 3);
  });

  it("returns +1 when winner has 1 fewer mistake", () => {
    assert.strictEqual(calculateMistakeModifier(1, 2), 1);
  });

  it("returns 0 when both players have the same mistakes", () => {
    assert.strictEqual(calculateMistakeModifier(2, 2), 0);
  });

  it("returns -1 when winner has 1 more mistake", () => {
    assert.strictEqual(calculateMistakeModifier(2, 1), -1);
  });

  it("returns -3 when winner has 2 more mistakes", () => {
    assert.strictEqual(calculateMistakeModifier(2, 0), -3);
  });

  it("returns -5 when winner has 3 more mistakes", () => {
    assert.strictEqual(calculateMistakeModifier(3, 0), -5);
  });
});

describe("calculateWinningEloGain", () => {
  it("returns the base gain when ELO and mistakes are equal", () => {
    assert.strictEqual(
      calculateWinningEloGain({
        winnerElo: 100,
        opponentElo: 100,
        winnerMistakes: 2,
        opponentMistakes: 2,
      }),
      30,
    );
  });

  it("applies the positive mistake modifier", () => {
    assert.strictEqual(
      calculateWinningEloGain({
        winnerElo: 100,
        opponentElo: 100,
        winnerMistakes: 0,
        opponentMistakes: 3,
      }),
      35,
    );
  });

  it("applies the negative mistake modifier", () => {
    assert.strictEqual(
      calculateWinningEloGain({
        winnerElo: 100,
        opponentElo: 100,
        winnerMistakes: 3,
        opponentMistakes: 0,
      }),
      25,
    );
  });

  it("scales the gain when defeating a higher-ranked opponent", () => {
    assert.strictEqual(
      calculateWinningEloGain({
        winnerElo: 100,
        opponentElo: 200,
        winnerMistakes: 2,
        opponentMistakes: 2,
      }),
      36,
    );
  });

  it("uses continuous scaling for a partial 100-point difference", () => {
    assert.strictEqual(
      calculateWinningEloGain({
        winnerElo: 100,
        opponentElo: 150,
        winnerMistakes: 2,
        opponentMistakes: 2,
      }),
      33,
    );
  });

  it("does not scale the gain against a lower-ranked opponent", () => {
    assert.strictEqual(
      calculateWinningEloGain({
        winnerElo: 200,
        opponentElo: 100,
        winnerMistakes: 2,
        opponentMistakes: 2,
      }),
      30,
    );
  });

  it("combines mistake modifier, rank scaling, and rounding", () => {
    assert.strictEqual(
      calculateWinningEloGain({
        winnerElo: 100,
        opponentElo: 200,
        winnerMistakes: 1,
        opponentMistakes: 3,
      }),
      40,
    );
  });
});
