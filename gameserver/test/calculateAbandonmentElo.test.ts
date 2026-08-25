import assert from "assert";
import { calculateAbandomentEloLoss } from "../src/elo/calculateAbandonmentElo.js";

describe("calculateAbandomentEloLoss", () => {
  it("returns the base loss ELO when a player leaves the game", () => {
    assert.strictEqual(calculateAbandomentEloLoss(), 20);
  });
});
