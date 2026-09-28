import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import TutorialGrid, {
  type CellIntent,
  type GridLit,
} from "../components/TutorialGrid";
import { Button, Icon, Logo } from "../components/ui";
import { PUZZLES } from "../tutorial/puzzles";
import { OverlapFigure } from "../tutorial/OverlapFigure";
import {
  STEPS,
  boardStateBefore,
  stepTargets,
  type Focus,
} from "../tutorial/steps";
import "./Tutorial.css";

// How long a finished step lingers before it advances itself, so the last
// square you marked has a moment to land.
const ADVANCE_DELAY = 780;
// Covers the longest sweep (the 15 × 15 reveal) plus its transition.
const SWEEP_DURATION = 1600;

const EMPTY: Set<number> = new Set();

function cellSizeFor(dim: number, viewportWidth: number): number {
  const narrow = viewportWidth <= 768;
  if (dim <= 5) return narrow ? 40 : 56;
  if (dim <= 10) return narrow ? 24 : 38;
  return narrow ? 16 : 26;
}

function litFrom(
  focus: Focus | undefined,
  width: number,
  height: number,
): GridLit | null {
  if (!focus) return null;
  const cells = new Set<number>();
  for (const r of focus.rows ?? []) {
    for (let c = 0; c < width; c++) cells.add(r * width + c);
  }
  for (const c of focus.cols ?? []) {
    for (let r = 0; r < height; r++) cells.add(r * width + c);
  }
  for (const [r, c] of focus.cells ?? []) cells.add(r * width + c);

  const rowClues = new Set(focus.rowClues ?? []);
  const colClues = new Set(focus.colClues ?? []);
  if (cells.size === 0 && rowClues.size === 0 && colClues.size === 0) {
    return null;
  }
  return { cells, rowClues, colClues };
}

/** Renders `**bold**`. Nothing else in the step bodies needs markup. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong
            key={i}
            style={{ color: "var(--color-ink)", fontWeight: 700 }}
          >
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function Tutorial() {
  const navigate = useNavigate();

  const [index, setIndex] = useState(0);
  // Keyed by step so a step change resets progress without an extra render.
  const [progress, setProgress] = useState<{ at: number; done: Set<number> }>({
    at: 0,
    done: new Set(),
  });
  // Steps that mark the board themselves get one sweep on arrival; `showMe`
  // borrows the same sweep when it is filling in more than a few squares.
  const [sweptStep, setSweptStep] = useState(-1);
  const [manualSweep, setManualSweep] = useState(-1);
  const [nudge, setNudge] = useState<{
    idx: number;
    seq: number;
    message: string;
  } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1200 : window.innerWidth,
  );
  const nudgeSeq = useRef(0);

  const step = STEPS[index];
  const puzzle = PUZZLES[step.board];
  const targets = useMemo(() => stepTargets(index), [index]);
  const selfMarking =
    step.action.kind === "auto" || step.action.kind === "solve";
  const targetSet = useMemo(() => new Set(targets), [targets]);

  // A self-marking step needs no input, so its squares count as already done —
  // derived here rather than pushed into state from an effect.
  const done = selfMarking
    ? targetSet
    : progress.at === index
      ? progress.done
      : EMPTY;
  const remaining = targets.filter((idx) => !done.has(idx));
  const stepComplete = remaining.length === 0;
  // Reveal steps sweep as well, so the finished picture colours in from the
  // middle out instead of snapping over in a single frame.
  const sweeps = selfMarking || step.reveal === true;
  const sweep = (sweeps && sweptStep !== index) || manualSweep === index;

  useEffect(() => {
    function onResize() {
      setViewportWidth(window.innerWidth);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // The sweep is the one part of a self-marking step that is time-based: the
  // squares all change at once and the grid staggers them, so the delays only
  // need to stay in place until the animation has run.
  useEffect(() => {
    if (!sweeps) return;
    const timer = setTimeout(() => setSweptStep(index), SWEEP_DURATION);
    return () => clearTimeout(timer);
  }, [index, sweeps]);

  const total = STEPS.length;
  const isLast = index === total - 1;

  const advance = useCallback(() => {
    setIndex((i) => Math.min(i + 1, total - 1));
  }, [total]);

  // Interactive steps move on by themselves once every square is marked.
  useEffect(() => {
    const action = STEPS[index].action;
    if (action.kind !== "fill" && action.kind !== "cross") return;
    if (!stepComplete) return;
    const timer = setTimeout(advance, ADVANCE_DELAY);
    return () => clearTimeout(timer);
  }, [index, stepComplete, advance]);

  useEffect(() => {
    if (!nudge) return;
    const timer = setTimeout(() => setNudge(null), 2600);
    return () => clearTimeout(timer);
  }, [nudge]);

  const base = useMemo(() => boardStateBefore(index), [index]);

  const { filled, crossed } = useMemo(() => {
    const f = new Set(base.filled);
    const c = new Set(base.crossed);
    const action = STEPS[index].action;
    const crossing = action.kind === "cross";
    for (const idx of done) {
      if (crossing) c.add(idx);
      else {
        f.add(idx);
        c.delete(idx);
      }
    }
    return { filled: f, crossed: c };
  }, [base, done, index]);

  const targetIntent: CellIntent | null =
    step.action.kind === "cross"
      ? "cross"
      : step.action.kind === "read"
        ? null
        : "fill";

  const coarsePointer =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;

  function complain(idx: number, message: string) {
    nudgeSeq.current += 1;
    setNudge({ idx, seq: nudgeSeq.current, message });
  }

  function onCellAction(row: number, col: number, intent: CellIntent) {
    const idx = row * puzzle.width + col;
    if (targetIntent === null) {
      complain(idx, "Nothing to mark on this step — read on, then hit Next.");
      return;
    }
    if (!targetSet.has(idx)) {
      complain(idx, "Stick to the highlighted squares for now.");
      return;
    }
    if (intent !== targetIntent) {
      complain(
        idx,
        targetIntent === "cross"
          ? coarsePointer
            ? "This square gets a ✕, not a fill."
            : "Right-click this one to mark it empty."
          : "This square gets filled in — left-click it.",
      );
      return;
    }
    setProgress((prev) => {
      const done = prev.at === index ? new Set(prev.done) : new Set<number>();
      if (done.has(idx)) return prev;
      done.add(idx);
      return { at: index, done };
    });
  }

  function showMe() {
    const bulk = remaining.length > 3;
    setProgress({ at: index, done: new Set(targets) });
    if (bulk) {
      setManualSweep(index);
      setTimeout(() => setManualSweep(-1), SWEEP_DURATION);
    }
  }

  const cs = cellSizeFor(Math.max(puzzle.width, puzzle.height), viewportWidth);
  const lit = litFrom(step.focus, puzzle.width, puzzle.height);

  const interactive =
    step.action.kind === "fill" || step.action.kind === "cross";
  // Only a step the learner finished themselves earns the green tick; a step
  // that filled itself in has nothing to congratulate.
  const chipDone = interactive && stepComplete;
  const actionLabel = (() => {
    if (interactive) {
      if (stepComplete) return "Nice — moving on";
      const verb = step.action.kind === "fill" ? "Fill in" : "Mark empty";
      return `${verb} ${remaining.length} more ${
        remaining.length === 1 ? "square" : "squares"
      }`;
    }
    if (selfMarking) return "Filling itself in — no need to click";
    return "Read, then continue";
  })();

  return (
    <div className="mp-tut-page">
      <div className="mp-topbar mp-tut-topbar">
        <button className="mp-tut-exit" onClick={() => navigate("/")}>
          <Icon name="arrow-left" size={14} color="var(--color-ink-faint)" />
          Main menu
        </button>
        <Logo size={22} />
        <button
          className="mp-tut-exit mp-tut-skip"
          onClick={() => navigate("/")}
        >
          Skip tutorial
        </button>
      </div>

      <div className="mp-tut-layout">
        {/* ── Board ─────────────────────────────────────────────────────── */}
        <div className="mp-tut-board-col">
          <div className="mp-tut-board-head">
            <span className="mp-eyebrow">
              {puzzle.width} × {puzzle.height}
            </span>
            {lit !== null && (
              <span className="mp-tut-spotlight-note">
                Only what matters right now is lit
              </span>
            )}
          </div>

          <div
            className="mp-tut-stage"
            data-spotlight={lit !== null ? "on" : "off"}
          >
            <TutorialGrid
              key={step.board}
              width={puzzle.width}
              height={puzzle.height}
              rowClues={puzzle.rowClues}
              colClues={puzzle.colClues}
              filled={filled}
              crossed={crossed}
              cellSize={cs}
              lit={lit}
              targets={stepComplete ? EMPTY : targetSet}
              targetIntent={targetIntent}
              revealed={step.reveal === true}
              accent={puzzle.accent}
              sweep={sweep}
              nudge={nudge}
              onCellAction={onCellAction}
            />
          </div>

          <div className="mp-tut-legend">
            <LegendRow
              active={targetIntent === "fill"}
              swatch={<span className="mp-tut-swatch-fill" />}
              label="Fill"
              hint={coarsePointer ? "tap" : "left-click, or drag along a line"}
            />
            <LegendRow
              active={targetIntent === "cross"}
              swatch={<span className="mp-tut-swatch-cross">✕</span>}
              label="Mark empty"
              hint={
                coarsePointer ? "tap — the game has a ✕ switch" : "right-click"
              }
            />
          </div>
        </div>

        {/* ── Instructions ──────────────────────────────────────────────── */}
        <div className="mp-surface mp-tut-panel">
          <div className="mp-tut-progress">
            <div className="mp-tut-progress-meta">
              <span className="mp-eyebrow">{step.phase}</span>
              <span className="mp-tut-progress-count">
                {index + 1} / {total}
              </span>
            </div>
            <div className="mp-tut-progress-track">
              <div
                className="mp-tut-progress-fill"
                style={{ width: `${((index + 1) / total) * 100}%` }}
              />
            </div>
          </div>

          <h1 className="mp-tut-title">{step.title}</h1>

          <div className="mp-tut-body">
            {step.body.map((para, i) => (
              <p key={i}>
                <Rich text={para} />
              </p>
            ))}
          </div>

          {step.figure?.kind === "overlap" && (
            <OverlapFigure height={step.figure.height} run={step.figure.run} />
          )}

          <div
            className="mp-tut-action"
            data-state={chipDone ? "done" : "todo"}
          >
            {chipDone ? (
              <Icon name="check" size={14} color="var(--color-sage-500)" />
            ) : (
              <Icon name="info" size={14} color="var(--color-blue-500)" />
            )}
            {actionLabel}
          </div>

          <div className="mp-tut-controls">
            <Button
              variant="ghost"
              size="sm"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            >
              Back
            </Button>

            {!stepComplete && (
              <Button variant="ghost" size="sm" onClick={showMe}>
                Show me
              </Button>
            )}

            {isLast ? (
              <div className="mp-tut-finish">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setProgress({ at: 0, done: new Set() });
                    // Clearing this lets the reveal steps sweep again on a
                    // second run through.
                    setSweptStep(-1);
                    setManualSweep(-1);
                    setIndex(0);
                  }}
                >
                  Restart
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate("/singleplayer")}
                >
                  Play Singleplayer
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                size="md"
                disabled={!stepComplete}
                onClick={advance}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>

      {nudge && (
        <div className="mp-toast" role="status">
          <Icon name="info" size={14} color="var(--color-coral-400)" />
          {nudge.message}
        </div>
      )}
    </div>
  );
}

function LegendRow({
  active,
  swatch,
  label,
  hint,
}: {
  active: boolean;
  swatch: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <div className="mp-tut-legend-row" data-active={active ? "yes" : "no"}>
      {swatch}
      <span className="mp-tut-legend-label">{label}</span>
      <span className="mp-tut-legend-hint">{hint}</span>
    </div>
  );
}
