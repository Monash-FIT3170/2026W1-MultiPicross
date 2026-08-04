export type WinningEloInput = {
  winnerElo: number;
  opponentElo: number;
  winnerMistakes: number;
  opponentMistakes: number;
};

export function calculateMistakeModifier(
  winnerMistakes: number,
  opponentMistakes: number,
): number {
  const difference = opponentMistakes - winnerMistakes;

  switch (difference) {
    case 3:
      return 5;
    case 2:
      return 3;
    case 1:
      return 1;
    case 0:
      return 0;
    case -1:
      return -1;
    case -2:
      return -3;
    default:
      return -5;
  }
}

export function calculateWinningEloGain({
  winnerElo,
  opponentElo,
  winnerMistakes,
  opponentMistakes,
}: WinningEloInput): number {
  const baseGain = 30;

  const mistakeModifier = calculateMistakeModifier(
    winnerMistakes,
    opponentMistakes,
  );

  const eloDifference = opponentElo - winnerElo;

  const rankMultiplier =
    eloDifference > 0 ? 1 + (eloDifference / 100) * 0.2 : 1;

  return Math.round((baseGain + mistakeModifier) * rankMultiplier);
}
