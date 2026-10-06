// Preset puzzles for the tutorial. Each solution is written as ASCII art so it
// can be eyeballed against the picture it draws; the clues are derived from the
// art rather than typed out, so a clue can never drift from its solution.

export type BoardId = "small" | "medium" | "large";

export interface TutorialPuzzle {
  id: BoardId;
  /** Shown once the puzzle is revealed. */
  picture: string;
  width: number;
  height: number;
  /** Row-major, `true` = filled. */
  solution: boolean[];
  rowClues: number[][];
  colClues: number[][];
  /** Colour the finished picture animates to. */
  accent: string;
}

function parse(art: string[]): {
  width: number;
  height: number;
  solution: boolean[];
} {
  const height = art.length;
  const width = art[0].length;
  if (art.some((line) => line.length !== width)) {
    throw new Error("tutorial puzzle rows must all be the same length");
  }
  return {
    width,
    height,
    solution: art.flatMap((line) => [...line].map((ch) => ch === "#")),
  };
}

// A run of zero length is written as [0], matching the usual nonogram
// convention for an entirely empty line.
function runs(line: boolean[]): number[] {
  const out: number[] = [];
  let n = 0;
  for (const cell of line) {
    if (cell) n++;
    else if (n > 0) {
      out.push(n);
      n = 0;
    }
  }
  if (n > 0) out.push(n);
  return out.length > 0 ? out : [0];
}

function cluesOf(solution: boolean[], width: number, height: number) {
  const rowClues: number[][] = [];
  for (let r = 0; r < height; r++) {
    rowClues.push(runs(solution.slice(r * width, r * width + width)));
  }
  const colClues: number[][] = [];
  for (let c = 0; c < width; c++) {
    const col: boolean[] = [];
    for (let r = 0; r < height; r++) col.push(solution[r * width + c]);
    colClues.push(runs(col));
  }
  return { rowClues, colClues };
}

function build(
  id: BoardId,
  picture: string,
  accent: string,
  art: string[],
): TutorialPuzzle {
  const { width, height, solution } = parse(art);
  return {
    id,
    picture,
    width,
    height,
    solution,
    accent,
    ...cluesOf(solution, width, height),
  };
}

// 5×5 — the whole walkthrough happens on this one. Every deduction it needs is
// one of the three moves the tutorial teaches, in that order: a forced full
// line, a certain overlap, then a finished clue that rules out the rest.
const SMALL = build("small", "a little tree", "var(--color-sage-400)", [
  ".###.",
  "#####",
  "#####",
  ".###.",
  "..#..",
]);

// 10×10 — shown briefly. Row 3–6 are clued 10 (forced full lines) and column 3
// is clued 8 in a column of 10 (a six-cell overlap), so the moves from the 5×5
// transfer verbatim. Row 1's `2 2` is the tutorial's one example of a
// multi-number clue.
const MEDIUM = build("medium", "a heart", "var(--color-coral-400)", [
  ".##....##.",
  "####..####",
  "##########",
  "##########",
  "##########",
  "##########",
  ".########.",
  "..######..",
  "...####...",
  "....##....",
]);

// 15×15 — only ever revealed, never solved, so it just has to look like the
// payoff for learning the rules.
const LARGE = build("large", "a cat", "var(--color-lavender-300)", [
  "##...........##",
  "###.........###",
  "####.......####",
  "##.#########.##",
  "#..#########..#",
  "..###########..",
  "..##.#####.##..",
  "..##.#####.##..",
  "..###########..",
  ".#####.#.#####.",
  ".####..#..####.",
  ".#####.#.#####.",
  "..###########..",
  "...#########...",
  "....#######....",
]);

export const PUZZLES: Record<BoardId, TutorialPuzzle> = {
  small: SMALL,
  medium: MEDIUM,
  large: LARGE,
};
