import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, stagger, createTimeline, steps, spring } from "animejs";

export type CellValue = 0 | 1 | 2 | 3; // unknown | filled | cross | mistake

interface NonogramGridProps {
  rowClues: number[][];
  colClues: number[][];
  grid: CellValue[];
  width: number;
  height: number;
  interactive?: boolean;
  // Drops every cell border. For the blurred opponent board: a blur leaves
  // gridlines crisp enough to count cells against.
  hideGridlines?: boolean;
  // Blanks the clue numbers but keeps the gutters, so the board keeps its size.
  // Struck-through clues would leak solved lines straight through the blur.
  hideClues?: boolean;
  cellSize?: number;
  colors?: string[];
  completed?: boolean;
  mistakeCrossIdx?: number | null;
  mistakeCrossIndices?: number[];
  onFill?: (row: number, col: number) => void;
  onCross?: (row: number, col: number, markCross: boolean) => void;
}

export function autoCellSize(w: number, h: number): number {
  const dim = Math.max(w, h);
  if (dim <= 5) return 48;
  if (dim <= 10) return 38;
  if (dim <= 15) return 30;
  return 24;
}

// Turns the three per-cell boolean arrays a board is stored as into the
// CellValue[] the grid renders. Precedence is load-bearing: a confirmed fill
// beats a server-revealed empty, which beats a player's own cross.
export function cellsToGrid(
  confirmedFilled: boolean[],
  crosses: boolean[],
  revealedEmpty: boolean[],
): CellValue[] {
  return confirmedFilled.map((filled, i) =>
    filled ? 1 : revealedEmpty[i] ? 3 : crosses[i] ? 2 : 0,
  );
}

function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export { fmtSeconds };

export default function NonogramGrid({
  rowClues,
  colClues,
  grid,
  width,
  height,
  interactive = true,
  hideGridlines = false,
  hideClues = false,
  cellSize,
  colors,
  completed = false,
  mistakeCrossIdx,
  mistakeCrossIndices,
  onFill,
  onCross,
}: NonogramGridProps) {
  const cs = cellSize ?? autoCellSize(width, height);

  const maxRowClueLen = Math.max(1, ...rowClues.map((r) => r.length));
  const maxColClueLen = Math.max(1, ...colClues.map((c) => c.length));

  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const prevGrid = useRef<CellValue[]>([...grid]);

  // Clue element refs
  const rowClueRefs = useRef<(HTMLDivElement | null)[]>([]);
  const colClueRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Drag state refs (avoid re-renders during drag)
  const dragActiveRef = useRef(false);
  const dragStartRef = useRef<{ row: number; col: number } | null>(null);
  const dragAxisRef = useRef<"row" | "col" | null>(null);
  const lastFillRef = useRef<{ row: number; col: number } | null>(null);

  // Keep a ref to the current grid so the document mouseup handler can read it
  const gridRef = useRef(grid);
  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  // These state flags keep `opacity: 0` stable in React's virtual DOM while
  // anime.js animates the real DOM. Because React only patches changed props,
  // keeping opacity at 0 in React state means React never overwrites anime.js's
  // intermediate opacity values during re-renders (e.g. from the timer tick).
  const [cellsIntroPlaying, setCellsIntroPlaying] = useState(true);
  const [cluesIntroPlaying, setCluesIntroPlaying] = useState(true);

  // ── Start animation (on mount) ─────────────────────────────────────────────
  // useLayoutEffect runs before the first browser paint, so nothing is ever
  // visible before the animation begins — no flash on load or continue.
  useLayoutEffect(() => {
    const cells = cellRefs.current.filter(Boolean) as HTMLButtonElement[];

    if (cells.length === 0) {
      setCellsIntroPlaying(false);
      setCluesIntroPlaying(false);
      return;
    }

    // steps(1): each cell snaps in as a whole block at its stagger time.
    // When all cells are done, chain into the clue animations.
    animate(cells, {
      opacity: [0, 1],
      delay: stagger(45, { grid: [width, height], from: "center" }),
      duration: 50,
      ease: steps(1),
      onComplete: () => {
        setCellsIntroPlaying(false);

        const rowClueEls = rowClueRefs.current.filter(
          Boolean,
        ) as HTMLDivElement[];
        const colClueEls = colClueRefs.current.filter(
          Boolean,
        ) as HTMLDivElement[];

        if (rowClueEls.length === 0 && colClueEls.length === 0) {
          setCluesIntroPlaying(false);
          return;
        }

        // Each slot-distance group across all sides animates together.
        // Distance 0 = closest to grid, animates first with no extra delay.
        // Distance N adds N * 45ms. This is the same for row and col clues,
        // so all sides' first clues appear together, then the second set, etc.
        const clueSpring = spring({ stiffness: 320, damping: 20 });

        let doneCt = 0;
        const total =
          (rowClueEls.length > 0 ? 1 : 0) + (colClueEls.length > 0 ? 1 : 0);
        const onClueDone = () => {
          if (++doneCt >= total) setCluesIntroPlaying(false);
        };

        if (rowClueEls.length > 0) {
          animate(rowClueEls, {
            opacity: [0, 1],
            scale: [0.65, 1],
            delay: (_el: Element, i: number) => {
              const slot = i % maxRowClueLen;
              return (maxRowClueLen - 1 - slot) * 45;
            },
            ease: clueSpring,
            onComplete: onClueDone,
          });
        }

        if (colClueEls.length > 0) {
          animate(colClueEls, {
            opacity: [0, 1],
            scale: [0.65, 1],
            delay: (_el: Element, i: number) => {
              const slotInCol = Math.floor(i / width);
              return (maxColClueLen - 1 - slotInCol) * 45;
            },
            ease: clueSpring,
            onComplete: onClueDone,
          });
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Completion animation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!completed || !colors) return;
    const cells = cellRefs.current.filter(Boolean) as HTMLButtonElement[];
    if (cells.length === 0) return;

    const timeoutId = setTimeout(() => {
      // Fade out cross/stripe SVG overlays
      const svgs = cells.flatMap((el) =>
        Array.from(el.querySelectorAll("svg")),
      );
      if (svgs.length > 0) {
        animate(svgs as Element[], {
          opacity: [1, 0],
          duration: 200,
          ease: "outQuad",
        });
      }

      // Anime.js reads backgroundColor from el.style before falling back to
      // getComputedStyle. If the inline value is a CSS variable like
      // "var(--color-blue-500)", anime.js cannot parse it as a color and instead
      // treats it as a COMPLEX string — animating the number 500→0 inside the
      // template, producing "var(--color-blue-0)" (undefined) which renders as
      // transparent/white. Resolve each cell's computed color into a concrete
      // rgb() value before the animation reads it.
      cells.forEach((el) => {
        el.style.backgroundColor = getComputedStyle(el).backgroundColor;
      });

      const tl = createTimeline({ defaults: { ease: "outQuad" } });

      // Collapse only inner borders; outer grid edge borders are preserved.
      // The right outer border lives on col=width-1 cells (borderRight=groupBorder),
      // the bottom outer border on row=height-1 cells — both are excluded here.
      const innerRight = cells.filter((_, i) => i % width < width - 1);
      const innerBottom = cells.filter(
        (_, i) => Math.floor(i / width) < height - 1,
      );
      if (innerRight.length > 0)
        tl.add(innerRight, { borderRightWidth: "0px", duration: 380 }, 0);
      if (innerBottom.length > 0)
        tl.add(innerBottom, { borderBottomWidth: "0px", duration: 380 }, 0);

      tl.add(
        cells,
        {
          backgroundColor: (_el: Element, i: number) => colors[i] ?? "#ffffff",
          delay: stagger(38, { grid: [width, height], from: "center" }),
          duration: 680,
        },
        "-=80",
      );
    }, 350);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  // ── Cell transition animations (pop/shake) ─────────────────────────────────
  useEffect(() => {
    if (completed) return;
    grid.forEach((val, idx) => {
      const prev = prevGrid.current[idx] ?? 0;
      if (val === prev) return;
      const el = cellRefs.current[idx];
      if (!el) return;

      if (val === 1 && prev === 0) {
        if (idx === mistakeCrossIdx) {
          el.classList.remove("mp-shake");
          void el.offsetWidth;
          el.classList.add("mp-shake");
          setTimeout(() => el.classList.remove("mp-shake"), 420);
        } else {
          el.classList.remove("mp-pop");
          void el.offsetWidth;
          el.classList.add("mp-pop");
          setTimeout(() => el.classList.remove("mp-pop"), 350);
        }
      } else if (val === 3 && prev === 0) {
        // Stop drag on mistake
        if (dragActiveRef.current) {
          dragActiveRef.current = false;
          dragStartRef.current = null;
          dragAxisRef.current = null;
          lastFillRef.current = null;
        }
        el.classList.remove("mp-shake");
        void el.offsetWidth;
        el.classList.add("mp-shake");
        setTimeout(() => el.classList.remove("mp-shake"), 420);
      }
    });
    prevGrid.current = [...grid];
  }, [grid, completed, mistakeCrossIdx]);

  // ── Document mouseup for drag cleanup ─────────────────────────────────────
  useEffect(() => {
    function handleMouseUp() {
      dragActiveRef.current = false;
      dragStartRef.current = null;
      dragAxisRef.current = null;
      lastFillRef.current = null;
    }
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  // ── Row/col completion tracking (for clue strikethrough) ──────────────────
  const rowFilled = rowClues.map((clue, r) => {
    const expected = clue.reduce((a, b) => a + b, 0);
    let filled = 0;
    for (let c = 0; c < width; c++) if (grid[r * width + c] === 1) filled++;
    return filled >= expected; // 0-clue rows: 0 >= 0 = true (always done)
  });

  const colFilled = colClues.map((clue, c) => {
    const expected = clue.reduce((a, b) => a + b, 0);
    let filled = 0;
    for (let r = 0; r < height; r++) if (grid[r * width + c] === 1) filled++;
    return filled >= expected;
  });

  // ── Cell styles ────────────────────────────────────────────────────────────
  function cellStyle(
    row: number,
    col: number,
    val: CellValue,
  ): React.CSSProperties {
    const idx = row * width + col;
    const isLastCol = col === width - 1;
    const isLastRow = row === height - 1;
    const isEveryFiveRight = (col + 1) % 5 === 0 && !isLastCol;
    const isEveryFiveBottom = (row + 1) % 5 === 0 && !isLastRow;

    // undefined leaves the `border: "none"` below in force.
    const innerBorder = hideGridlines ? undefined : "1px solid #d6d2c8";
    const groupBorder = hideGridlines
      ? undefined
      : "2px solid var(--color-line-strong)";

    const base: React.CSSProperties = {
      width: cs,
      height: cs,
      border: "none",
      padding: 0,
      cursor: interactive && val === 0 ? "pointer" : "default",
      position: "relative",
      transition: "background-color 80ms ease",
      boxSizing: "border-box",
      borderLeft: col === 0 ? groupBorder : undefined,
      borderTop: row === 0 ? groupBorder : undefined,
      borderRight: isLastCol
        ? groupBorder
        : isEveryFiveRight
          ? groupBorder
          : innerBorder,
      borderBottom: isLastRow
        ? groupBorder
        : isEveryFiveBottom
          ? groupBorder
          : innerBorder,
      outline: "none",
      // Keep opacity: 0 in React's virtual DOM while the intro animation is
      // running. React diffs 0→0 on re-renders and never touches the real
      // DOM's opacity, so anime.js can animate freely without interference.
      // After intro completes, opacity is omitted so CSS default (1) applies.
      opacity: cellsIntroPlaying ? 0 : undefined,
    };

    // Use longhand (backgroundColor + backgroundImage) for every case to avoid
    // React's warning about mixing shorthand and longhand during re-renders.
    switch (val) {
      case 1: {
        // Mistake-cross cells show red diagonal stripes over blue until the puzzle is complete
        const isMC = !completed && mistakeCrossIndices?.includes(idx);
        return {
          ...base,
          backgroundColor: "var(--color-blue-500)",
          backgroundImage: isMC
            ? "repeating-linear-gradient(-45deg, rgba(220,38,38,0.38) 0px, rgba(220,38,38,0.38) 4px, transparent 4px, transparent 11px)"
            : "none",
          cursor: "default",
        };
      }
      case 3:
        return {
          ...base,
          backgroundColor: "#faecea",
          backgroundImage: "none",
          cursor: "default",
        };
      default:
        return { ...base, backgroundColor: "#ffffff", backgroundImage: "none" };
    }
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────
  function handleCellMouseDown(e: React.MouseEvent, row: number, col: number) {
    if (e.button !== 0) return;
    if (!interactive) return;
    const val = grid[row * width + col];
    if (val !== 0) return;
    dragActiveRef.current = true;
    dragStartRef.current = { row, col };
    dragAxisRef.current = null;
    lastFillRef.current = { row, col };
    onFill?.(row, col);
  }

  function handleCellMouseEnter(row: number, col: number) {
    if (!dragActiveRef.current || !dragStartRef.current) return;
    const { row: startRow, col: startCol } = dragStartRef.current;

    if (dragAxisRef.current === null) {
      if (row !== startRow) dragAxisRef.current = "col";
      else if (col !== startCol) dragAxisRef.current = "row";
      else return;
    }

    if (dragAxisRef.current === "row" && row !== startRow) return;
    if (dragAxisRef.current === "col" && col !== startCol) return;

    // Fill all cells between last filled position and current to cover fast-drag gaps.
    // Duplicate onFill calls for already-filled cells are safely ignored (guest: functional
    // update guard; auth: server returns 400 which is silently dropped).
    const last = lastFillRef.current;
    if (dragAxisRef.current === "row") {
      const minC = Math.min(last ? last.col : col, col);
      const maxC = Math.max(last ? last.col : col, col);
      for (let c = minC; c <= maxC; c++) {
        if (gridRef.current[row * width + c] === 0) onFill?.(row, c);
      }
    } else {
      const minR = Math.min(last ? last.row : row, row);
      const maxR = Math.max(last ? last.row : row, row);
      for (let r = minR; r <= maxR; r++) {
        if (gridRef.current[r * width + col] === 0) onFill?.(r, col);
      }
    }
    lastFillRef.current = { row, col };
  }

  function handleContextMenu(e: React.MouseEvent, row: number, col: number) {
    e.preventDefault();
    if (!interactive) return;
    const val = grid[row * width + col];
    if (val === 1 || val === 3) return;
    onCross?.(row, col, val !== 2);
  }

  // ── Clue cell base style ───────────────────────────────────────────────────
  const clueBaseStyle: React.CSSProperties = {
    width: cs,
    height: cs,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-ui)",
    fontSize: Math.max(10, cs * 0.38),
    fontWeight: 600,
    color: "var(--color-ink-clue)",
    fontVariantNumeric: "tabular-nums",
    userSelect: "none",
    flexShrink: 0,
  };

  // ── Layout ─────────────────────────────────────────────────────────────────
  const totalCols = maxRowClueLen + width;
  const totalRows = maxColClueLen + height;

  const cells: React.ReactNode[] = [];

  for (let gridRow = 0; gridRow < totalRows; gridRow++) {
    for (let gridCol = 0; gridCol < totalCols; gridCol++) {
      const key = `${gridRow}-${gridCol}`;
      const isClueRow = gridRow < maxColClueLen;
      const isClueCol = gridCol < maxRowClueLen;
      const row = gridRow - maxColClueLen;
      const col = gridCol - maxRowClueLen;

      if (isClueRow && isClueCol) {
        cells.push(<div key={key} style={{ width: cs, height: cs }} />);
      } else if (isClueRow) {
        // Column clue: slotIdx is gridRow within this column's clue block
        const slotIdx = gridRow - (maxColClueLen - colClues[col].length);
        const num = slotIdx >= 0 ? colClues[col][slotIdx] : null;
        const done = colFilled[col];
        const refIdx = gridRow * width + col;
        cells.push(
          <div
            key={key}
            ref={(el) => {
              colClueRefs.current[refIdx] = el;
            }}
            style={{
              ...clueBaseStyle,
              color: done
                ? "var(--color-line-strong)"
                : "var(--color-ink-clue)",
              textDecoration: done ? "line-through" : undefined,
              opacity: cluesIntroPlaying ? 0 : undefined,
            }}
          >
            {hideClues ? "" : (num ?? "")}
          </div>,
        );
      } else if (isClueCol) {
        // Row clue: slotIdx is gridCol within this row's clue block
        const slotIdx = gridCol - (maxRowClueLen - rowClues[row].length);
        const num = slotIdx >= 0 ? rowClues[row][slotIdx] : null;
        const done = rowFilled[row];
        const refIdx = row * maxRowClueLen + gridCol;
        cells.push(
          <div
            key={key}
            ref={(el) => {
              rowClueRefs.current[refIdx] = el;
            }}
            style={{
              ...clueBaseStyle,
              color: done
                ? "var(--color-line-strong)"
                : "var(--color-ink-clue)",
              textDecoration: done ? "line-through" : undefined,
              opacity: cluesIntroPlaying ? 0 : undefined,
            }}
          >
            {hideClues ? "" : (num ?? "")}
          </div>,
        );
      } else {
        // Game cell
        const idx = row * width + col;
        const val = grid[idx];
        cells.push(
          <button
            key={key}
            ref={(el) => {
              cellRefs.current[idx] = el;
            }}
            style={cellStyle(row, col, val)}
            onMouseDown={(e) => handleCellMouseDown(e, row, col)}
            onMouseEnter={() => handleCellMouseEnter(row, col)}
            onContextMenu={(e) => handleContextMenu(e, row, col)}
            aria-label={`Cell row ${row + 1} col ${col + 1}`}
          >
            {val === 2 && (
              <svg
                viewBox="0 0 20 20"
                style={{
                  width: cs * 0.5,
                  height: cs * 0.5,
                  position: "absolute",
                  inset: "50%",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                }}
              >
                <line
                  x1="4"
                  y1="4"
                  x2="16"
                  y2="16"
                  stroke="var(--color-coral-400)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <line
                  x1="16"
                  y1="4"
                  x2="4"
                  y2="16"
                  stroke="var(--color-coral-400)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {val === 3 && (
              <svg
                viewBox="0 0 20 20"
                style={{
                  width: cs * 0.45,
                  height: cs * 0.45,
                  position: "absolute",
                  inset: "50%",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                }}
              >
                <line
                  x1="4"
                  y1="4"
                  x2="16"
                  y2="16"
                  stroke="var(--color-coral-400)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <line
                  x1="16"
                  y1="4"
                  x2="4"
                  y2="16"
                  stroke="var(--color-coral-400)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>,
        );
      }
    }
  }

  return (
    <div
      style={{
        display: "inline-grid",
        gridTemplateColumns: `repeat(${totalCols}, ${cs}px)`,
        gridTemplateRows: `repeat(${totalRows}, ${cs}px)`,
        userSelect: "none",
      }}
    >
      {cells}
    </div>
  );
}
