import { useEffect, useRef } from "react";

export type CellIntent = "fill" | "cross";

/**
 * Which parts of the board are under the spotlight. `null` means the whole
 * board is lit; otherwise everything absent from these sets is darkened.
 */
export interface GridLit {
  cells: Set<number>;
  rowClues: Set<number>;
  colClues: Set<number>;
}

interface TutorialGridProps {
  width: number;
  height: number;
  rowClues: number[][];
  colClues: number[][];
  filled: Set<number>;
  crossed: Set<number>;
  cellSize: number;
  lit: GridLit | null;
  /** Cells the learner is being asked to mark this step. */
  targets: Set<number>;
  targetIntent: CellIntent | null;
  /** Paints the finished picture in the puzzle's accent colour. */
  revealed?: boolean;
  accent: string;
  /**
   * Adds a per-cell transition delay so a batch of cells changing at once
   * sweeps out from the centre instead of snapping.
   */
  sweep?: boolean;
  /** Cell to shake, paired with a counter so the same cell can shake twice. */
  nudge?: { idx: number; seq: number } | null;
  onCellAction?: (row: number, col: number, intent: CellIntent) => void;
}

// Declared on .mp-tut-stage in Tutorial.css and inherited from it, so the
// spotlight can be retuned in one place. Each is the normal colour of that part
// of the board mixed toward the stage's scrim.
const DIM_CELL = "var(--tut-dim-cell)";
const DIM_LINE = "var(--tut-dim-line)";
const DIM_FRAME = "var(--tut-dim-frame)";
const DIM_INK = "var(--tut-dim-ink)";
const DIM_FILL = "var(--tut-dim-fill)";
const DIM_CROSS = "var(--tut-dim-cross)";
// Behind a lit clue, so it sits in a patch of undimmed stage.
const LIT_BG = "var(--tut-lit-bg)";

export default function TutorialGrid({
  width,
  height,
  rowClues,
  colClues,
  filled,
  crossed,
  cellSize: cs,
  lit,
  targets,
  targetIntent,
  revealed = false,
  accent,
  sweep = false,
  nudge = null,
  onCellAction,
}: TutorialGridProps) {
  const spotlight = lit !== null;
  const clueInk = "var(--color-ink-clue)";
  const clueDoneInk = "var(--color-line-strong)";

  const maxRowClueLen = Math.max(1, ...rowClues.map((r) => r.length));
  const maxColClueLen = Math.max(1, ...colClues.map((c) => c.length));

  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dragIntent = useRef<CellIntent | null>(null);

  // Re-trigger the shake by removing the class and forcing a reflow, so a
  // second wrong click on the same cell still animates.
  useEffect(() => {
    if (!nudge) return;
    const el = cellRefs.current[nudge.idx];
    if (!el) return;
    el.classList.remove("mp-tut-shake");
    void el.offsetWidth;
    el.classList.add("mp-tut-shake");
    const t = setTimeout(() => el.classList.remove("mp-tut-shake"), 420);
    return () => clearTimeout(t);
  }, [nudge]);

  useEffect(() => {
    function stop() {
      dragIntent.current = null;
    }
    document.addEventListener("mouseup", stop);
    return () => document.removeEventListener("mouseup", stop);
  }, []);

  // Distance from the centre, used only for the sweep's transition delay.
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  function sweepDelay(row: number, col: number): number {
    if (!sweep) return 0;
    return Math.round(Math.hypot(col - cx, row - cy) * 34);
  }

  // A clue is struck through once its line holds as many fills as it asks for.
  // The tutorial only ever hands out correct fills, so a matching count here
  // really does mean the clue is finished.
  const rowDone = rowClues.map((clue, r) => {
    const want = clue.reduce((a, b) => a + b, 0);
    let have = 0;
    for (let c = 0; c < width; c++) if (filled.has(r * width + c)) have++;
    return have >= want;
  });
  const colDone = colClues.map((clue, c) => {
    const want = clue.reduce((a, b) => a + b, 0);
    let have = 0;
    for (let r = 0; r < height; r++) if (filled.has(r * width + c)) have++;
    return have >= want;
  });

  function pointerIntent(): CellIntent {
    // On touch there is no right-click, so a tap does whatever the step asks
    // for. On a mouse, a left click always fills — that is what it does in the
    // real game, and getting nudged is how the tutorial teaches the difference.
    if (window.matchMedia("(pointer: coarse)").matches) {
      return targetIntent ?? "fill";
    }
    return "fill";
  }

  const slots: React.ReactNode[] = [];
  const totalCols = maxRowClueLen + width;
  const totalRows = maxColClueLen + height;

  const clueBase: React.CSSProperties = {
    width: cs,
    height: cs,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-ui)",
    fontSize: Math.max(11, Math.round(cs * 0.4)),
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    userSelect: "none",
    flexShrink: 0,
    transition:
      "color 260ms var(--ease-out), background-color 260ms var(--ease-out)",
  };

  for (let gr = 0; gr < totalRows; gr++) {
    for (let gc = 0; gc < totalCols; gc++) {
      const key = `${gr}-${gc}`;
      const inClueRow = gr < maxColClueLen;
      const inClueCol = gc < maxRowClueLen;
      const row = gr - maxColClueLen;
      const col = gc - maxRowClueLen;

      if (inClueRow && inClueCol) {
        slots.push(<div key={key} style={{ width: cs, height: cs }} />);
        continue;
      }

      if (inClueRow) {
        const clue = colClues[col];
        const slotIdx = gr - (maxColClueLen - clue.length);
        const num = slotIdx >= 0 ? clue[slotIdx] : null;
        const dim = spotlight && !lit.colClues.has(col);
        slots.push(
          <div
            key={key}
            style={{
              ...clueBase,
              color: dim ? DIM_INK : colDone[col] ? clueDoneInk : clueInk,
              backgroundColor: spotlight && !dim ? LIT_BG : "transparent",
              textDecoration: !dim && colDone[col] ? "line-through" : undefined,
            }}
          >
            {num ?? ""}
          </div>,
        );
        continue;
      }

      if (inClueCol) {
        const clue = rowClues[row];
        const slotIdx = gc - (maxRowClueLen - clue.length);
        const num = slotIdx >= 0 ? clue[slotIdx] : null;
        const dim = spotlight && !lit.rowClues.has(row);
        slots.push(
          <div
            key={key}
            style={{
              ...clueBase,
              color: dim ? DIM_INK : rowDone[row] ? clueDoneInk : clueInk,
              backgroundColor: spotlight && !dim ? LIT_BG : "transparent",
              textDecoration: !dim && rowDone[row] ? "line-through" : undefined,
            }}
          >
            {num ?? ""}
          </div>,
        );
        continue;
      }

      const idx = row * width + col;
      const dim = spotlight && !lit.cells.has(idx);
      const isFilled = filled.has(idx);
      const isCrossed = crossed.has(idx);
      const isTarget = targets.has(idx);

      const isLastCol = col === width - 1;
      const isLastRow = row === height - 1;
      const heavyRight = (col + 1) % 5 === 0 && !isLastCol;
      const heavyBottom = (row + 1) % 5 === 0 && !isLastRow;

      // While revealed the picture should read as one shape, so inner borders
      // go and only the outer frame stays.
      const inner = dim
        ? `1px solid ${DIM_LINE}`
        : revealed
          ? "1px solid transparent"
          : "1px solid #d6d2c8";
      const heavy = dim
        ? `2px solid ${DIM_FRAME}`
        : revealed
          ? "2px solid transparent"
          : "2px solid var(--color-line-strong)";
      const frame = dim
        ? `2px solid ${DIM_FRAME}`
        : "2px solid var(--color-line-strong)";

      let background: string;
      if (dim)
        background = isFilled ? DIM_FILL : revealed ? "transparent" : DIM_CELL;
      else if (isFilled)
        background = revealed ? accent : "var(--color-blue-500)";
      // Once revealed the empty squares drop out, so the picture reads as one
      // shape against the stage instead of sitting in a white slab.
      else background = revealed ? "transparent" : "#ffffff";

      const ring =
        targetIntent === "cross"
          ? "var(--color-coral-400)"
          : "var(--color-blue-500)";
      const delay = sweepDelay(row, col);

      slots.push(
        <button
          key={key}
          ref={(el) => {
            cellRefs.current[idx] = el;
          }}
          className={isTarget ? "mp-tut-target" : undefined}
          style={
            {
              width: cs,
              height: cs,
              padding: 0,
              boxSizing: "border-box",
              position: "relative",
              outline: "none",
              cursor: isTarget ? "pointer" : "default",
              backgroundColor: background,
              borderLeft: col === 0 ? frame : undefined,
              borderTop: row === 0 ? frame : undefined,
              borderRight: isLastCol ? frame : heavyRight ? heavy : inner,
              borderBottom: isLastRow ? frame : heavyBottom ? heavy : inner,
              transition:
                "background-color 380ms var(--ease-out), border-color 380ms var(--ease-out)",
              transitionDelay: `${delay}ms`,
              "--mp-tut-ring": ring,
            } as React.CSSProperties
          }
          onMouseDown={(e) => {
            // Right-click is handled by onContextMenu; taking it here too would
            // run every cross twice.
            if (e.button !== 0) return;
            const intent = pointerIntent();
            // Only a correct mark starts a drag, and a drag only ever extends
            // across squares the step asked for — otherwise sweeping the mouse
            // across the board would fire one nudge per cell.
            if (isTarget && intent === targetIntent) {
              dragIntent.current = intent;
            }
            onCellAction?.(row, col, intent);
          }}
          onMouseEnter={() => {
            if (dragIntent.current && isTarget) {
              onCellAction?.(row, col, dragIntent.current);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            onCellAction?.(row, col, "cross");
          }}
          aria-label={`Row ${row + 1}, column ${col + 1}${
            isFilled ? ", filled" : isCrossed ? ", marked empty" : ""
          }${isTarget ? " — highlighted" : ""}`}
        >
          {/* Faint preview of the mark being asked for. */}
          {isTarget && !isFilled && !isCrossed && (
            <span
              style={{
                position: "absolute",
                inset: Math.max(3, cs * 0.16),
                borderRadius: 2,
                pointerEvents: "none",
                background: targetIntent === "fill" ? ring : "none",
                opacity: targetIntent === "fill" ? 0.24 : 1,
              }}
            >
              {targetIntent === "cross" && (
                <CrossMark size="100%" color={ring} opacity={0.34} />
              )}
            </span>
          )}
          {isCrossed && !isFilled && (
            <CrossMark
              size={cs * 0.5}
              color={dim ? DIM_CROSS : "var(--color-coral-400)"}
              opacity={revealed ? 0 : 1}
            />
          )}
        </button>,
      );
    }
  }

  return (
    <div
      className="mp-tut-board"
      style={{
        display: "inline-grid",
        gridTemplateColumns: `repeat(${totalCols}, ${cs}px)`,
        gridTemplateRows: `repeat(${totalRows}, ${cs}px)`,
        userSelect: "none",
        touchAction: "manipulation",
      }}
    >
      {slots}
    </div>
  );
}

function CrossMark({
  size,
  color,
  opacity = 1,
}: {
  size: number | string;
  color: string;
  opacity?: number;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      style={{
        width: size,
        height: size,
        position: "absolute",
        inset: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        opacity,
        transition: "opacity 300ms var(--ease-out)",
      }}
    >
      <line
        x1="4"
        y1="4"
        x2="16"
        y2="16"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="4"
        x2="4"
        y2="16"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
