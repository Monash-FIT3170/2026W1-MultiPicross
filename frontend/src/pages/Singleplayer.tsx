import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, parseApiError } from "../api/client";
import NonogramGrid, {
  type CellValue,
  fmtSeconds,
  autoCellSize,
} from "../components/NonogramGrid";
import {
  Logo,
  Icon,
  BackButton,
  Button,
  LivesPips,
  StatTile,
  Chip,
} from "../components/ui";

// ──── Types ─────────────────────────────────────────────────────────────────

interface PuzzleSize {
  width: number;
  height: number;
  count: number;
}

interface ActiveCompletion {
  id: string;
  puzzleId: string;
  width: number;
  height: number;
  rowClues: number[][];
  colClues: number[][];
  confirmedFilled: boolean[];
  crosses: boolean[];
  revealedEmpty: boolean[];
  mistakeCross: boolean[];
  livesLeft: number;
  elapsedSeconds: number;
}

interface GameState {
  completionId?: string;
  width: number;
  height: number;
  rowClues: number[][];
  colClues: number[][];
  grid: CellValue[];
  livesLeft: number;
  baseElapsed: number;
  isGuest: boolean;
  solution?: number[];
  colors?: string[];
  mistakeCrossIndices?: number[];
}

type Phase =
  | { kind: "loading" }
  | {
      kind: "size-select";
      sizes: PuzzleSize[];
      activeCompletion: ActiveCompletion | null;
    }
  | { kind: "active-choice"; completion: ActiveCompletion; sizes: PuzzleSize[] }
  | { kind: "loading-puzzle" }
  | { kind: "playing"; game: GameState; outcome: null | "won" | "failed" }
  | { kind: "error"; message: string };

interface ActionResponse {
  result: "correct" | "mistake" | "cross" | "uncross" | "mistake-cross";
  livesLeft: number;
  completed?: boolean;
  gameOver?: boolean;
  colors?: string[];
}

// ──── Helpers ────────────────────────────────────────────────────────────────

// After a correct fill, cross out all remaining empty cells in any row or column
// whose clue total is now fully satisfied. 0-clue rows/cols are satisfied immediately.
function applyAutoComplete(
  grid: CellValue[],
  rowClues: number[][],
  colClues: number[][],
  width: number,
  height: number,
): CellValue[] {
  const out = [...grid] as CellValue[];
  for (let r = 0; r < height; r++) {
    const needed = rowClues[r].reduce((a, b) => a + b, 0);
    let filled = 0;
    for (let c = 0; c < width; c++) if (out[r * width + c] === 1) filled++;
    if (filled >= needed) {
      for (let c = 0; c < width; c++) {
        if (out[r * width + c] === 0) out[r * width + c] = 2;
      }
    }
  }
  for (let c = 0; c < width; c++) {
    const needed = colClues[c].reduce((a, b) => a + b, 0);
    let filled = 0;
    for (let r = 0; r < height; r++) if (out[r * width + c] === 1) filled++;
    if (filled >= needed) {
      for (let r = 0; r < height; r++) {
        if (out[r * width + c] === 0) out[r * width + c] = 2;
      }
    }
  }
  return out;
}

function completionToGameState(c: ActiveCompletion): GameState {
  const rawGrid: CellValue[] = c.confirmedFilled.map((filled, i) =>
    filled ? 1 : c.revealedEmpty[i] ? 3 : c.crosses[i] ? 2 : 0,
  );
  const grid = applyAutoComplete(
    rawGrid,
    c.rowClues,
    c.colClues,
    c.width,
    c.height,
  );
  return {
    completionId: c.id,
    width: c.width,
    height: c.height,
    rowClues: c.rowClues,
    colClues: c.colClues,
    grid,
    livesLeft: c.livesLeft,
    baseElapsed: c.elapsedSeconds,
    isGuest: false,
    mistakeCrossIndices: (c.mistakeCross as boolean[]).reduce<number[]>(
      (acc, v, i) => {
        if (v) acc.push(i);
        return acc;
      },
      [],
    ),
  };
}

// ──── Main component ─────────────────────────────────────────────────────────

export function Singleplayer() {
  const navigate = useNavigate();
  const { status } = useAuth();

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [mistakeFlash, setMistakeFlash] = useState(false);
  const [mistakeCrossIdx, setMistakeCrossIdx] = useState<number | null>(null);

  // Stable key for PlayingScreen, increments each time a fresh game starts
  const gameKeyRef = useRef(0);

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === "loading") return;

    async function init() {
      try {
        const sizesRes = await apiFetch("/singleplayer/sizes");
        if (!sizesRes.ok) throw new Error(await parseApiError(sizesRes));
        const { sizes } = (await sizesRes.json()) as { sizes: PuzzleSize[] };

        if (status === "authenticated") {
          const activeRes = await apiFetch("/singleplayer/active");
          if (activeRes.ok) {
            const { completion } = (await activeRes.json()) as {
              completion: ActiveCompletion | null;
            };
            if (completion) {
              setPhase({ kind: "active-choice", completion, sizes });
              return;
            }
          }
        }

        setPhase({ kind: "size-select", sizes, activeCompletion: null });
      } catch (e) {
        setPhase({ kind: "error", message: String(e) });
      }
    }

    void init();
  }, [status]);

  // ── Timer ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase.kind !== "playing" || phase.outcome !== null) return;
    const startWall = Date.now() - phase.game.baseElapsed * 1000;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing; seeds the clock so it doesn't read 0 for the first second
    setDisplaySeconds(Math.floor((Date.now() - startWall) / 1000));
    const id = setInterval(() => {
      setDisplaySeconds(Math.floor((Date.now() - startWall) / 1000));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    phase.kind === "playing" ? (phase.game.completionId ?? "guest") : null,
    phase.kind,
    phase.kind === "playing" ? phase.outcome : null,
  ]);

  // ── Start game ─────────────────────────────────────────────────────────────

  async function startAuthGame(width: number, height: number) {
    setPhase({ kind: "loading-puzzle" });
    try {
      const res = await apiFetch("/singleplayer/start", {
        method: "POST",
        body: JSON.stringify({ width, height }),
      });
      if (!res.ok) {
        setPhase({ kind: "error", message: await parseApiError(res) });
        return;
      }
      const { completion } = (await res.json()) as {
        completion: ActiveCompletion;
      };
      gameKeyRef.current++;
      setPhase({
        kind: "playing",
        game: completionToGameState(completion),
        outcome: null,
      });
    } catch (e) {
      setPhase({ kind: "error", message: String(e) });
    }
  }

  async function startGuestGame(width: number, height: number) {
    setPhase({ kind: "loading-puzzle" });
    try {
      const res = await apiFetch(
        `/singleplayer/guest-puzzle?width=${width}&height=${height}`,
      );
      if (!res.ok) {
        setPhase({ kind: "error", message: await parseApiError(res) });
        return;
      }
      const data = (await res.json()) as {
        width: number;
        height: number;
        rowClues: number[][];
        colClues: number[][];
        solution: number[];
        colors: string[];
      };
      const game: GameState = {
        width: data.width,
        height: data.height,
        rowClues: data.rowClues,
        colClues: data.colClues,
        grid: applyAutoComplete(
          Array<CellValue>(data.width * data.height).fill(0),
          data.rowClues,
          data.colClues,
          data.width,
          data.height,
        ),
        livesLeft: 3,
        baseElapsed: 0,
        isGuest: true,
        solution: data.solution,
        colors: data.colors,
        mistakeCrossIndices: [],
      };
      gameKeyRef.current++;
      setPhase({ kind: "playing", game, outcome: null });
    } catch (e) {
      setPhase({ kind: "error", message: String(e) });
    }
  }

  function handleSelectSize(width: number, height: number) {
    if (status === "authenticated") {
      void startAuthGame(width, height);
    } else {
      void startGuestGame(width, height);
    }
  }

  // ── Cell actions ───────────────────────────────────────────────────────────

  function flashMistake() {
    setMistakeFlash(true);
    setTimeout(() => setMistakeFlash(false), 1200);
  }

  function handleFill(row: number, col: number) {
    if (phase.kind !== "playing" || phase.outcome !== null) return;
    const { game } = phase;
    const idx = row * game.width + col;

    if (game.isGuest) {
      if (game.solution![idx] !== 1) {
        if (game.livesLeft > 1) flashMistake();
      }
      // Functional update so rapid gap-fill calls chain correctly instead of overwriting each other
      setPhase((cur) => {
        if (cur.kind !== "playing" || cur.outcome !== null) return cur;
        const g = cur.game;
        if (g.grid[idx] !== 0) return cur;
        const newGrid = [...g.grid] as CellValue[];
        if (g.solution![idx] === 1) {
          newGrid[idx] = 1;
          const autoGrid = applyAutoComplete(
            newGrid,
            g.rowClues,
            g.colClues,
            g.width,
            g.height,
          );
          const allDone = g.solution!.every(
            (s, i) => s === 0 || autoGrid[i] === 1,
          );
          return {
            kind: "playing",
            game: { ...g, grid: autoGrid },
            outcome: allDone ? "won" : null,
          };
        } else {
          newGrid[idx] = 3;
          const newLives = g.livesLeft - 1;
          return {
            kind: "playing",
            game: { ...g, grid: newGrid, livesLeft: Math.max(0, newLives) },
            outcome: newLives <= 0 ? "failed" : null,
          };
        }
      });
    } else {
      void (async () => {
        try {
          const res = await apiFetch("/singleplayer/action", {
            method: "POST",
            body: JSON.stringify({ row, col, kind: "fill" }),
          });
          if (!res.ok) return;
          const data = (await res.json()) as ActionResponse;
          // Side effects before functional update
          if (data.result === "mistake" && !data.gameOver) flashMistake();
          // Functional update ensures concurrent drag responses apply on latest state
          setPhase((cur) => {
            if (cur.kind !== "playing") return cur;
            const g = cur.game;
            const newGrid = [...g.grid] as CellValue[];
            if (data.result === "correct") {
              newGrid[idx] = 1;
              const autoGrid = applyAutoComplete(
                newGrid,
                g.rowClues,
                g.colClues,
                g.width,
                g.height,
              );
              return {
                kind: "playing",
                game: {
                  ...g,
                  grid: autoGrid,
                  livesLeft: data.livesLeft,
                  colors: data.completed ? data.colors : g.colors,
                },
                outcome: data.completed ? "won" : null,
              };
            } else if (data.result === "mistake") {
              newGrid[idx] = 3;
              return {
                kind: "playing",
                game: { ...g, grid: newGrid, livesLeft: data.livesLeft },
                outcome: data.gameOver ? "failed" : null,
              };
            }
            return cur;
          });
        } catch {
          /* ignore */
        }
      })();
    }
  }

  function handleCross(row: number, col: number, markCross: boolean) {
    if (phase.kind !== "playing" || phase.outcome !== null) return;
    const { game } = phase;
    const idx = row * game.width + col;

    if (game.isGuest) {
      if (markCross && game.solution![idx] === 1) {
        // Crossing a filled cell, mistake
        const newLives = game.livesLeft - 1;
        setMistakeCrossIdx(idx);
        setTimeout(() => setMistakeCrossIdx(null), 450);
        if (newLives > 0) {
          // Check allDone with the new grid state to suppress flash if completing
          const tentativeGrid = [...game.grid] as CellValue[];
          tentativeGrid[idx] = 1;
          const allDone = game.solution!.every(
            (s, i) => s === 0 || tentativeGrid[i] === 1,
          );
          if (!allDone) flashMistake();
        }
        setPhase((cur) => {
          if (cur.kind !== "playing" || cur.outcome !== null) return cur;
          const g = cur.game;
          const newGrid = [...g.grid] as CellValue[];
          newGrid[idx] = 1;
          const autoGrid = applyAutoComplete(
            newGrid,
            g.rowClues,
            g.colClues,
            g.width,
            g.height,
          );
          const lives = g.livesLeft - 1;
          const allDone = g.solution!.every(
            (s, i) => s === 0 || autoGrid[i] === 1,
          );
          return {
            kind: "playing",
            game: {
              ...g,
              grid: autoGrid,
              livesLeft: Math.max(0, lives),
              mistakeCrossIndices: [...(g.mistakeCrossIndices ?? []), idx],
            },
            outcome: lives <= 0 ? "failed" : allDone ? "won" : null,
          };
        });
      } else {
        const newGrid = [...game.grid] as CellValue[];
        newGrid[idx] = markCross ? 2 : 0;
        setPhase({
          kind: "playing",
          game: { ...game, grid: newGrid },
          outcome: null,
        });
      }
    } else {
      void (async () => {
        try {
          const res = await apiFetch("/singleplayer/action", {
            method: "POST",
            body: JSON.stringify({
              row,
              col,
              kind: markCross ? "cross" : "uncross",
            }),
          });
          if (!res.ok) return;
          const data = (await res.json()) as ActionResponse;
          // Side effects before functional update
          if (data.result === "mistake-cross") {
            setMistakeCrossIdx(idx);
            setTimeout(() => setMistakeCrossIdx(null), 450);
            if (!data.gameOver && !data.completed) flashMistake();
          }
          setPhase((cur) => {
            if (cur.kind !== "playing") return cur;
            const g = cur.game;
            const newGrid = [...g.grid] as CellValue[];
            if (data.result === "mistake-cross") {
              newGrid[idx] = 1;
              const autoGrid = applyAutoComplete(
                newGrid,
                g.rowClues,
                g.colClues,
                g.width,
                g.height,
              );
              const newMCI = [...(g.mistakeCrossIndices ?? []), idx];
              if (data.completed) {
                return {
                  kind: "playing",
                  game: {
                    ...g,
                    grid: autoGrid,
                    livesLeft: data.livesLeft,
                    colors: data.colors,
                    mistakeCrossIndices: newMCI,
                  },
                  outcome: "won",
                };
              }
              return {
                kind: "playing",
                game: {
                  ...g,
                  grid: autoGrid,
                  livesLeft: data.livesLeft,
                  mistakeCrossIndices: newMCI,
                },
                outcome: data.gameOver ? "failed" : null,
              };
            } else {
              newGrid[idx] = markCross ? 2 : 0;
              return {
                kind: "playing",
                game: { ...g, grid: newGrid },
                outcome: null,
              };
            }
          });
        } catch {
          /* ignore */
        }
      })();
    }
  }

  async function handleAbandon() {
    if (phase.kind !== "playing") return;
    if (!phase.game.isGuest) {
      try {
        await apiFetch("/singleplayer/abandon", { method: "POST" });
      } catch {
        /* ignore */
      }
    }
    navigate("/");
  }

  function handlePlayAgain() {
    if (phase.kind !== "playing") return;
    setPhase({ kind: "loading" });
    // Re-run init
    void (async () => {
      try {
        const sizesRes = await apiFetch("/singleplayer/sizes");
        const { sizes: s } = (await sizesRes.json()) as { sizes: PuzzleSize[] };
        setPhase({ kind: "size-select", sizes: s, activeCompletion: null });
      } catch {
        navigate("/");
      }
    })();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="mp-page mp-singleplayer"
      style={{ minHeight: "100vh", background: "var(--color-paper)" }}
    >
      {phase.kind === "loading" && <CenteredSpinner />}
      {phase.kind === "loading-puzzle" && <CenteredSpinner />}

      {phase.kind === "error" && (
        <div
          className="mp-active-resume"
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <Icon name="info" size={32} color="var(--color-coral-400)" />
          <p
            style={{
              color: "var(--color-ink-muted)",
              textAlign: "center",
              maxWidth: 320,
            }}
          >
            {phase.message}
          </p>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            Back to menu
          </Button>
        </div>
      )}

      {phase.kind === "size-select" && (
        <SizeSelectScreen
          sizes={phase.sizes}
          hasActiveGame={!!phase.activeCompletion}
          onContinue={() => {
            if (phase.activeCompletion) {
              setPhase({
                kind: "active-choice",
                completion: phase.activeCompletion,
                sizes: phase.sizes,
              });
            }
          }}
          onSelectSize={handleSelectSize}
          onBack={() => navigate("/")}
        />
      )}

      {phase.kind === "active-choice" && (
        <ActiveChoiceScreen
          completion={phase.completion}
          onContinue={() => {
            const game = completionToGameState(phase.completion);
            gameKeyRef.current++;
            setPhase({ kind: "playing", game, outcome: null });
          }}
          onNewGame={() =>
            setPhase({
              kind: "size-select",
              sizes: phase.sizes,
              activeCompletion: null,
            })
          }
          onBack={() => navigate("/")}
        />
      )}

      {phase.kind === "playing" && (
        <PlayingScreen
          // eslint-disable-next-line react-hooks/refs -- pre-existing; used as a remount key, converting it to state is a separate change
          key={gameKeyRef.current}
          game={phase.game}
          outcome={phase.outcome}
          displaySeconds={displaySeconds}
          mistakeFlash={mistakeFlash}
          mistakeCrossIdx={mistakeCrossIdx}
          interactive={phase.outcome === null}
          onFill={handleFill}
          onCross={handleCross}
          onAbandon={() => void handleAbandon()}
          onPlayAgain={handlePlayAgain}
          onMainMenu={() => navigate("/")}
        />
      )}
    </div>
  );
}

// ──── Sub-screens ────────────────────────────────────────────────────────────

function CenteredSpinner() {
  return (
    <div
      className="mp-page mp-size-select"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-ink-faint)",
        gap: 10,
      }}
    >
      <Icon name="refresh" size={18} color="var(--color-ink-faint)" />
      <span style={{ fontSize: 14 }}>Loading…</span>
    </div>
  );
}

function SizeSelectScreen({
  sizes,
  hasActiveGame,
  onContinue,
  onSelectSize,
  onBack,
}: {
  sizes: PuzzleSize[];
  hasActiveGame: boolean;
  onContinue: () => void;
  onSelectSize: (w: number, h: number) => void;
  onBack: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-paper)",
        padding: "24px 24px 80px",
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <BackButton onClick={onBack} label="Main menu" />
      </div>

      <h1
        style={{
          textAlign: "center",
          margin: "0 0 6px",
          fontSize: 30,
          fontWeight: 700,
          color: "var(--color-ink)",
          letterSpacing: "0.01em",
        }}
      >
        Singleplayer
      </h1>
      <p
        style={{
          textAlign: "center",
          margin: "0 0 36px",
          color: "var(--color-ink-muted)",
          fontSize: 14,
        }}
      >
        Choose a puzzle size to get started.
      </p>

      {hasActiveGame && (
        <div
          className="mp-outcome-banner"
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <div
            className="mp-surface"
            style={{
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <Icon name="refresh" size={16} color="var(--color-blue-500)" />
            <span style={{ fontSize: 14, color: "var(--color-ink-soft)" }}>
              You have an active game.
            </span>
            <Button variant="primary" size="sm" onClick={onContinue}>
              Continue
            </Button>
          </div>
        </div>
      )}

      <div
        className="mp-size-grid"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          justifyContent: "center",
        }}
      >
        {sizes.map((s) => (
          <button
            key={`${s.width}x${s.height}`}
            className="tile mp-size-tile"
            onClick={() => onSelectSize(s.width, s.height)}
            style={{ width: 160, height: 120 }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--color-ink)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {s.width} × {s.height}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-ink-faint)" }}>
              {s.count} puzzle{s.count !== 1 ? "s" : ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ActiveChoiceScreen({
  completion,
  onContinue,
  onNewGame,
  onBack,
}: {
  completion: ActiveCompletion;
  onContinue: () => void;
  onNewGame: () => void;
  onBack: () => void;
}) {
  return (
    <div
      className="mp-page mp-active-choice"
      style={{
        minHeight: "100vh",
        background: "var(--color-paper)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "24px 24px 0" }}>
        <BackButton onClick={onBack} label="Main menu" />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="mp-surface mp-dialog-card"
          style={{
            padding: 32,
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
          }}
        >
          <Icon
            name="refresh"
            size={32}
            color="var(--color-blue-500)"
            style={{ margin: "0 auto 16px" }}
          />
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--color-ink)",
            }}
          >
            Active game found
          </h2>
          <p
            style={{
              margin: "0 0 24px",
              color: "var(--color-ink-muted)",
              fontSize: 14,
            }}
          >
            You have an unfinished {completion.width}×{completion.height} puzzle
            with {completion.livesLeft}{" "}
            {completion.livesLeft === 1 ? "life" : "lives"} remaining.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Button variant="ghost" size="sm" onClick={onNewGame}>
              New game
            </Button>
            <Button variant="primary" size="sm" onClick={onContinue}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayingScreen({
  game,
  outcome,
  displaySeconds,
  mistakeFlash,
  mistakeCrossIdx,
  interactive,
  onFill,
  onCross,
  onAbandon,
  onPlayAgain,
  onMainMenu,
}: {
  game: GameState;
  outcome: "won" | "failed" | null;
  displaySeconds: number;
  mistakeFlash: boolean;
  mistakeCrossIdx: number | null;
  interactive: boolean;
  onFill: (row: number, col: number) => void;
  onCross: (row: number, col: number, mark: boolean) => void;
  onAbandon: () => void;
  onPlayAgain: () => void;
  onMainMenu: () => void;
}) {
  const [actionMode, setActionMode] = useState<"fill" | "cross">("fill");
  // Pre-compute clue area dimensions so the sidebar can center on the game cells
  const cs = autoCellSize(game.width, game.height);
  const maxColClueLen = Math.max(1, ...game.colClues.map((c) => c.length));
  const gridTotalHeight = (maxColClueLen + game.height) * cs;
  const clueTopOffset = maxColClueLen * cs;

  return (
    <div
      className="mp-page mp-playing-screen"
      style={{
        minHeight: "100vh",
        background: "var(--color-paper)",
        padding: "24px 24px 80px",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        className="mp-topbar mp-game-topbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
          position: "relative",
          zIndex: 200,
        }}
      >
        <button
          onClick={onMainMenu}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            color: "var(--color-ink-faint)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Icon name="arrow-left" size={14} color="var(--color-ink-faint)" />
          Main menu
        </button>
        <Logo size={22} />
        <div style={{ width: 100 }} />
      </div>

      <h1
        style={{
          textAlign: "center",
          margin: "0 0 6px",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--color-ink)",
        }}
      >
        Singleplayer
      </h1>
      <p
        className="mp-game-hint"
        style={{
          textAlign: "center",
          margin: "0 0 28px",
          color: "var(--color-ink-muted)",
          fontSize: 13,
        }}
      >
        Tap to fill. Switch to cross mode to mark empty cells.
      </p>

      <div
        className="mp-game-layout"
        style={{
          display: "flex",
          gap: 40,
          justifyContent: "center",
          alignItems: "flex-start",
          overflow: "hidden",
        }}
      >
        {/* Grid */}
        <NonogramGrid
          rowClues={game.rowClues}
          colClues={game.colClues}
          grid={game.grid}
          width={game.width}
          height={game.height}
          interactive={interactive}
          colors={game.colors}
          completed={outcome === "won"}
          mistakeCrossIdx={mistakeCrossIdx}
          mistakeCrossIndices={game.mistakeCrossIndices ?? []}
          actionMode={actionMode}
          onFill={onFill}
          onCross={onCross}
        />

        <div className="mp-mobile-controls" aria-label="Cell action mode">
          <button
            type="button"
            className={actionMode === "fill" ? "is-active" : ""}
            onClick={() => setActionMode("fill")}
          >
            Fill
          </button>
          <button
            type="button"
            className={actionMode === "cross" ? "is-active" : ""}
            onClick={() => setActionMode("cross")}
          >
            Cross
          </button>
        </div>

        {/* Wrapper that spans the full grid height but pads the top by the clue area height,
            so the sidebar card is flex-centered within just the game cells portion */}
        <div
          className="mp-game-sidebar-wrap"
          style={{
            height: gridTotalHeight,
            paddingTop: clueTopOffset,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div
            className="mp-surface mp-game-sidebar"
            style={{
              padding: "24px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 24,
              minWidth: 200,
            }}
          >
            <StatTile icon="grid" label="Size">
              {game.width} × {game.height}
            </StatTile>
            <StatTile icon="clock" label="Time">
              <span
                style={{
                  fontFamily: "Cairo, sans-serif",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtSeconds(displaySeconds)}
              </span>
            </StatTile>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="heart" size={13} color="var(--color-ink-faint)" />
                <span className="mp-eyebrow">Lives</span>
              </div>
              <LivesPips lives={game.livesLeft} />
            </div>
            <div style={{ height: 1, background: "var(--color-line)" }} />
            {game.isGuest && (
              <Chip
                tone="neutral"
                style={{ justifyContent: "center", fontSize: 11 }}
              >
                Guest mode
              </Chip>
            )}
            <Button
              variant="danger-soft"
              size="sm"
              onClick={onAbandon}
              disabled={outcome !== null}
            >
              Abandon
            </Button>
          </div>
        </div>
      </div>

      {/* Mistake flash */}
      {mistakeFlash && (
        <div className="mp-toast">
          <Icon name="x" size={14} color="var(--color-coral-500)" />
          <span>Not that one, one life used.</span>
        </div>
      )}

      {/* Win banner */}
      {outcome === "won" && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 32,
            transform: "translateX(-50%)",
            padding: "16px 24px",
            background: "var(--color-sage-50)",
            border: "1px solid var(--color-sage-100)",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            gap: 16,
            boxShadow: "0 18px 38px -12px rgba(76,175,120,0.25)",
            zIndex: 100,
            whiteSpace: "nowrap",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "var(--color-sage-400)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="check" size={16} color="#fff" />
          </div>
          <div>
            <div
              style={{
                fontWeight: 700,
                color: "var(--color-ink)",
                fontSize: 15,
              }}
            >
              Solved in {fmtSeconds(displaySeconds)}!
            </div>
            <div style={{ fontSize: 12, color: "var(--color-sage-500)" }}>
              {game.livesLeft}/3 lives remaining.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={onPlayAgain}>
              Play again
            </Button>
            <Button variant="primary" size="sm" onClick={onMainMenu}>
              Main Menu
            </Button>
          </div>
        </div>
      )}

      {/* Game-over banner */}
      {outcome === "failed" && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 32,
            transform: "translateX(-50%)",
            padding: "16px 24px",
            background: "var(--color-coral-50)",
            border: "1px solid var(--color-coral-100)",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            gap: 16,
            boxShadow: "var(--shadow-lg)",
            zIndex: 200,
            whiteSpace: "nowrap",
          }}
        >
          <Icon name="heart" size={22} color="var(--color-coral-500)" />
          <div
            style={{
              fontWeight: 600,
              color: "var(--color-coral-500)",
              fontSize: 14,
            }}
          >
            Out of lives. Try again?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={onPlayAgain}>
              Try again
            </Button>
            <Button variant="primary" size="sm" onClick={onMainMenu}>
              Main menu
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
