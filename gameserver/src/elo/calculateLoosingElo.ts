export type LoosingEloInput = {
  loosingElo: number;
  opponentElo: number;
  loosingMistakes: number;
  opponentMistakes: number;
};

export function calculateLooseMistakeModifier(
  loosingMistakes: number,
  opponentMistakes: number,
): number {
  const difference = opponentMistakes - loosingMistakes;

  switch (difference) {
    case 3:
      return 5;
    case 2:
      return 5;
    case 1:
      return 3;
    case 0:
      return 0;
    case -1:
      return -1;
    case -2:
      return -2;
    default:
      return -5;
  }
}

export function calculateLoosingEloGain({
  loosingElo,
  opponentElo,
  loosingMistakes,
  opponentMistakes,
}: LoosingEloInput): number {
  const baseLoss = 20;

  const mistakeModifier = calculateLooseMistakeModifier(
    loosingMistakes,
    opponentMistakes,
  );

  const eloDifference = opponentElo - loosingElo;

  const rankMultiplier =
    eloDifference > 0 ? 1 + (eloDifference / 100) * 0.15 : 1;

  return Math.min(
    Math.round((baseLoss + mistakeModifier) * rankMultiplier),
    40,
  );
}
