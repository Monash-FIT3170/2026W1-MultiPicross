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

  if (difference >= 3) return 5;
  if (difference === 2) return 3;
  if (difference === 1) return 1;
  if (difference === 0) return 0;
  if (difference === -1) return -1;
  if (difference === -2) return -3;

  return -5;
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
