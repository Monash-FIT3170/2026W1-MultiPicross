import { PUZZLES, type BoardId } from "./puzzles";

/** `[row, col]`, both zero-indexed. Prose in the steps is one-indexed. */
export type Coord = [number, number];

/**
 * Anything named here stays lit; everything else on the board is darkened.
 * An empty focus (or none at all) leaves the whole board lit.
 */
export interface Focus {
  rowClues?: number[];
  colClues?: number[];
  /** Whole grid rows / columns, clue gutters excluded. */
  rows?: number[];
  cols?: number[];
  cells?: Coord[];
}

export type StepAction =
  /** Nothing to do but read. */
  | { kind: "read" }
  | { kind: "fill"; targets: Coord[] }
  | { kind: "cross"; targets: Coord[] }
  /** Fills itself in on arrival — for moves too repetitive to hand over. */
  | { kind: "auto"; targets: Coord[] }
  /** Fills in every remaining square of the solution at once. */
  | { kind: "solve" };

export interface Step {
  id: string;
  board: BoardId;
  phase: string;
  title: string;
  /** Paragraphs. `**bold**` is honoured; nothing else is. */
  body: string[];
  action: StepAction;
  focus?: Focus;
  /** Paints the finished picture in the puzzle's colour. */
  reveal?: boolean;
  /** Draws the two-extremes diagram beside the text. */
  figure?: { kind: "overlap"; height: number; run: number };
}

const ALL5 = [0, 1, 2, 3, 4];

export const STEPS: Step[] = [
  // ── The rules ─────────────────────────────────────────────────────────────
  {
    id: "intro",
    board: "small",
    phase: "The rules",
    title: "This is a nonogram",
    body: [
      "A blank grid, and some numbers around the edge. Those numbers are a complete description of a hidden picture, and your job is to work out which squares are filled.",
      "There is always exactly **one** answer, and you never have to guess to find it. Everything you are about to do follows from a number you can point at.",
    ],
    action: { kind: "read" },
  },
  {
    id: "row-clues",
    board: "small",
    phase: "The rules",
    title: "The numbers on the left describe rows",
    body: [
      "Read a row's clue from left to right. Each number is the length of one solid, unbroken run of filled squares.",
      "Row 1's clue is **3**, so three filled squares sit side by side somewhere in that row — and the rest of the row is empty.",
      "When a row has two or more numbers, like **2 2**, the runs appear in that order with at least one empty square between them. You'll meet one of those later.",
    ],
    action: { kind: "read" },
    focus: { rowClues: ALL5 },
  },
  {
    id: "col-clues",
    board: "small",
    phase: "The rules",
    title: "The numbers on top describe columns",
    body: [
      "Same rule, read top to bottom instead.",
      "Column 3's clue is **5** — one run of five filled squares in that column.",
    ],
    action: { kind: "read" },
    focus: { colClues: ALL5 },
  },
  {
    id: "marks",
    board: "small",
    phase: "The rules",
    title: "Two marks to work with",
    body: [
      "**Left-click** fills a square in. Hold and drag to run along a line.",
      "**Right-click** puts a ✕ on a square — a note to yourself that it is definitely empty. On a phone, use the fill / ✕ switch next to the board.",
      "✕ marks are not part of the answer; they are how you stop re-checking squares you have already ruled out. Good solvers make nearly as many ✕ marks as fills.",
    ],
    action: { kind: "read" },
    focus: { rows: ALL5 },
  },

  // ── Move 1: a run that only fits one way ──────────────────────────────────
  {
    id: "full-row",
    board: "small",
    phase: "Your first solve",
    title: "Start where there is no choice",
    body: [
      "Row 2's clue is **5**, and the row is exactly 5 squares wide. A run of five has only one place to go: it fills the row.",
      "Fill in the highlighted squares.",
    ],
    action: {
      kind: "fill",
      targets: [
        [1, 0],
        [1, 1],
        [1, 2],
        [1, 3],
        [1, 4],
      ],
    },
    focus: { rowClues: [1], rows: [1] },
  },
  {
    id: "full-row-2",
    board: "small",
    phase: "Your first solve",
    title: "Your turn",
    body: [
      "Row 3's clue is **5** too. Same reasoning, same result.",
      "Notice that row 2's clue is now struck out. A struck-out clue is finished — there is nothing left to find in that line.",
    ],
    action: {
      kind: "fill",
      targets: [
        [2, 0],
        [2, 1],
        [2, 2],
        [2, 3],
        [2, 4],
      ],
    },
    focus: { rowClues: [2], rows: [2] },
  },
  {
    id: "full-col",
    board: "small",
    phase: "Your first solve",
    title: "Columns are no different",
    body: [
      "Column 3's clue is **5** on a board 5 squares tall, so the whole column is filled.",
      "Two of its squares came free from the rows you just did. Three are left.",
    ],
    action: {
      kind: "fill",
      targets: [
        [0, 2],
        [3, 2],
        [4, 2],
      ],
    },
    focus: { colClues: [2], cols: [2] },
  },

  // ── Move 2: overlap ───────────────────────────────────────────────────────
  {
    id: "overlap",
    board: "small",
    phase: "Your first solve",
    title: "A big clue forces part of itself",
    body: [
      "Column 2's clue is **4** in a column 5 tall, so the run has two possible positions: rows 1–4, or rows 2–5.",
      "Look at what they have in common. Rows 2, 3 and 4 are filled in **both** positions, so those three squares are certain even though you don't yet know which position is right. This is the single most useful move in the game.",
      "Rows 2 and 3 are already done, so fill row 4. Column 4's clue is **4** as well — same deduction, so fill row 4 there too.",
    ],
    action: {
      kind: "fill",
      targets: [
        [3, 1],
        [3, 3],
      ],
    },
    focus: { colClues: [1, 3], cols: [1, 3] },
    figure: { kind: "overlap", height: 5, run: 4 },
  },

  // ── Move 3: a finished clue rules out the rest ─────────────────────────────
  {
    id: "satisfied-row4",
    board: "small",
    phase: "Your first solve",
    title: "A finished clue rules out the rest",
    body: [
      "Row 4's clue is **3**, and you already have three filled squares in a row. That clue is complete, so every other square in the row must be empty.",
      "**Right-click** the two ends to mark them with a ✕.",
    ],
    action: {
      kind: "cross",
      targets: [
        [3, 0],
        [3, 4],
      ],
    },
    focus: { rowClues: [3], rows: [3] },
  },
  {
    id: "satisfied-row5",
    board: "small",
    phase: "Your first solve",
    title: "The same move, smaller clue",
    body: [
      "Row 5's clue is **1** — one filled square, and it is already there.",
      "Mark the other four empty.",
    ],
    action: {
      kind: "cross",
      targets: [
        [4, 0],
        [4, 1],
        [4, 3],
        [4, 4],
      ],
    },
    focus: { rowClues: [4], rows: [4] },
  },
  {
    id: "satisfied-cols",
    board: "small",
    phase: "Your first solve",
    title: "Now read the outside columns",
    body: [
      "Column 1's clue is **2**, and rows 2 and 3 are filled and touching — that is the run, complete. Everything else in the column is empty. Column 5 is the mirror image.",
      "The bottoms of both columns are already marked, so that leaves the top row.",
    ],
    action: {
      kind: "cross",
      targets: [
        [0, 0],
        [0, 4],
      ],
    },
    focus: { colClues: [0, 4], cols: [0, 4] },
  },
  {
    id: "last-row",
    board: "small",
    phase: "Your first solve",
    title: "One line left",
    body: [
      "Row 1's clue is **3**. Both ends are now ruled out, which leaves only the middle three squares — and that is exactly three.",
      "Fill the two that are still blank.",
    ],
    action: {
      kind: "fill",
      targets: [
        [0, 1],
        [0, 3],
      ],
    },
    focus: { rowClues: [0], rows: [0] },
  },
  {
    id: "solved-small",
    board: "small",
    phase: "Your first solve",
    title: `Solved — it was ${PUZZLES.small.picture}`,
    body: [
      "And you never guessed once. Every mark came from one of three moves:",
      "**A run that only fits one way.** **An overlap that holds in every position.** **A clue that is already finished, so the rest of the line is empty.**",
      "That is the entire game. Everything else is those three, applied faster.",
    ],
    action: { kind: "read" },
    reveal: true,
  },

  // ── Bigger boards ─────────────────────────────────────────────────────────
  {
    id: "medium-intro",
    board: "medium",
    phase: "Bigger boards",
    title: "Now a 10 × 10",
    body: [
      "Four times the squares, and not one new rule. The clue gutters are deeper because lines can hold more runs — row 1 up there reads **2 2**, meaning a run of two, then a gap of at least one, then another run of two.",
      "Watch the same three moves do the work.",
    ],
    action: { kind: "read" },
  },
  {
    id: "medium-full-rows",
    board: "medium",
    phase: "Bigger boards",
    title: "Move one, four times over",
    body: [
      "Rows 3, 4, 5 and 6 are each clued **10** on a board 10 wide. No choice at all — exactly the move you opened the 5 × 5 with.",
      "This one is on the house.",
    ],
    action: {
      kind: "auto",
      targets: [2, 3, 4, 5].flatMap((r) =>
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => [r, c] as Coord),
      ),
    },
    focus: { rowClues: [2, 3, 4, 5], rows: [2, 3, 4, 5] },
  },
  {
    id: "medium-overlap",
    board: "medium",
    phase: "Bigger boards",
    title: "Move two, on a taller column",
    body: [
      "Column 3's clue is **8** in a column 10 tall. Slide the run to the top, slide it to the bottom: rows 3 through 8 are covered either way. Six certain squares out of a single number.",
      "Rows 3 to 6 came free just now, so fill rows 7 and 8.",
    ],
    action: {
      kind: "fill",
      targets: [
        [6, 2],
        [7, 2],
      ],
    },
    focus: { colClues: [2], cols: [2] },
    figure: { kind: "overlap", height: 10, run: 8 },
  },
  {
    id: "medium-reveal",
    board: "medium",
    phase: "Bigger boards",
    title: `Keep going and you get ${PUZZLES.medium.picture}`,
    body: [
      "Forced runs, certain overlaps, finished clues — repeat until the board runs out. Here is the rest of it.",
    ],
    action: { kind: "solve" },
    reveal: true,
  },
  // Split in two on purpose: the board is blank on arrival so the reveal on the
  // next step has something to animate from.
  {
    id: "large-intro",
    board: "large",
    phase: "Bigger boards",
    title: "And a 15 × 15, just so you have seen one",
    body: [
      "The clue gutters are the only thing that really grows. Some lines here hold three separate runs — row 4 reads **2 9 2** — but each of those runs still means exactly what it meant on the 5 × 5.",
      "Row 6 is clued **11** in a row 15 wide. Before you read on: which squares does that force?",
    ],
    action: { kind: "read" },
  },
  {
    id: "large-reveal",
    board: "large",
    phase: "Bigger boards",
    title: "Seven of them, dead centre",
    body: [
      "A run of 11 in a row of 15 leaves 4 squares of slack, so columns 5 to 11 are filled whichever way it slides. Same overlap, bigger numbers.",
      "More lines to cross-reference and a longer sit-down, then — but there is genuinely nothing new to learn.",
    ],
    action: { kind: "solve" },
    reveal: true,
  },
  {
    id: "done",
    board: "large",
    phase: "Bigger boards",
    title: "You're ready",
    body: [
      "Start on 5 × 5 in Singleplayer to build up speed, then take it into a room against someone else.",
      "One thing the tutorial spared you: in a real game a wrong fill costs a life. So when you are not sure about a square, don't gamble on it — go and read a different line until one of them forces your hand.",
    ],
    action: { kind: "read" },
    reveal: true,
  },
];

export function indexOfStep(id: string): number {
  return STEPS.findIndex((s) => s.id === id);
}

function toIdx(targets: Coord[], width: number): number[] {
  return targets.map(([r, c]) => r * width + c);
}

/**
 * The board as it stands when `index` opens: every earlier step on the same
 * board, replayed. Deriving it means the Back button can never leave the board
 * out of step with the instructions.
 */
export function boardStateBefore(index: number): {
  filled: Set<number>;
  crossed: Set<number>;
} {
  const board = STEPS[index].board;
  const { width, solution } = PUZZLES[board];
  const filled = new Set<number>();
  const crossed = new Set<number>();

  for (let i = 0; i < index; i++) {
    const step = STEPS[i];
    if (step.board !== board) continue;
    switch (step.action.kind) {
      case "fill":
      case "auto":
        for (const idx of toIdx(step.action.targets, width)) {
          filled.add(idx);
          crossed.delete(idx);
        }
        break;
      case "cross":
        for (const idx of toIdx(step.action.targets, width)) crossed.add(idx);
        break;
      case "solve":
        solution.forEach((on, idx) => {
          if (on) {
            filled.add(idx);
            crossed.delete(idx);
          }
        });
        break;
      case "read":
        break;
    }
  }
  return { filled, crossed };
}

/** The squares `index` asks for, as flat indices. Empty for a read step. */
export function stepTargets(index: number): number[] {
  const step = STEPS[index];
  const { width, solution } = PUZZLES[step.board];
  switch (step.action.kind) {
    case "fill":
    case "cross":
    case "auto":
      return toIdx(step.action.targets, width);
    case "solve": {
      const { filled } = boardStateBefore(index);
      return solution.flatMap((on, idx) =>
        on && !filled.has(idx) ? [idx] : [],
      );
    }
    case "read":
      return [];
  }
}

/** True once the board is showing the finished picture for its puzzle. */
export function isRevealed(index: number): boolean {
  return STEPS[index].reveal === true;
}
