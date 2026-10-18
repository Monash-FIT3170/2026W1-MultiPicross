import { useEffect, useRef, type RefObject } from "react";

// The Teammate Cursor (2v2): each player's live pointer, shown on their
// teammate's copy of the shared Team Board. Positions travel in board
// coordinates — fractional column/row over the cell area, clue gutters
// excluded — so they land on the same spot whatever each window's size.
//
// Updates arrive ~20 times a second, unevenly, so none of this goes through
// React state: a re-render per update would redraw the whole board. The
// socket handler pushes into a CursorStream, and the overlay moves itself
// from a requestAnimationFrame loop by writing its transform directly.

export type CursorPosition = { x: number; y: number };

/** Sender throttle: at most one position per this many ms. */
const SEND_INTERVAL_MS = 50;

/**
 * How far behind real time the teammate's pointer is drawn. Rendering in the
 * past lets us interpolate between two received samples instead of jumping
 * to each one as it lands, which is what makes network jitter invisible.
 * Tune by feel (see issue 04): larger is smoother but laggier.
 */
export const INTERPOLATION_DELAY_MS = 100;

/** Received samples older than this are no longer needed for interpolation. */
const BUFFER_MS = 1000;

type Sample = { t: number; x: number; y: number };

export interface CursorStream {
  push(position: CursorPosition | null): void;
  /** Buffered samples, oldest first; empty means "no pointer to show". */
  readonly samples: Sample[];
}

export function createCursorStream(): CursorStream {
  const samples: Sample[] = [];
  return {
    samples,
    push(position) {
      if (position === null) {
        // Hide at once — no delay for a pointer that has left. The next
        // position then starts a fresh buffer, so the pointer snaps to it
        // rather than sliding across from where it disappeared.
        samples.length = 0;
        return;
      }
      const t = performance.now();
      samples.push({ t, ...position });
      while (samples.length > 2 && samples[1].t < t - BUFFER_MS) {
        samples.shift();
      }
    },
  };
}

/** Where the pointer should be drawn at `renderAt`, or null if hidden. */
export function sampleAt(
  samples: Sample[],
  renderAt: number,
): CursorPosition | null {
  if (samples.length === 0) return null;
  const first = samples[0];
  if (renderAt <= first.t) return { x: first.x, y: first.y };
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (renderAt <= b.t) {
      const k = (renderAt - a.t) / (b.t - a.t || 1);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
  }
  // Past the newest sample: hold there rather than guess where it's going.
  const last = samples[samples.length - 1];
  return { x: last.x, y: last.y };
}

/** Geometry of a NonogramGrid, in cells, for mapping pointer ↔ board. */
export interface BoardGeometry {
  width: number;
  height: number;
  /** Clue columns left of the cell area / clue rows above it. */
  rowClueCols: number;
  colClueRows: number;
  cellSize: number;
}

/**
 * Draws the teammate's pointer over a board. Must sit inside a positioned
 * wrapper whose top-left is the NonogramGrid's top-left.
 */
export function TeammateCursorOverlay({
  stream,
  geometry,
  visible,
  color,
}: {
  stream: CursorStream;
  geometry: BoardGeometry;
  visible: boolean;
  color: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const geometryRef = useRef(geometry);
  useEffect(() => {
    geometryRef.current = geometry;
  }, [geometry]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!visible) {
      el.style.opacity = "0";
      return;
    }
    let frame = 0;
    const tick = () => {
      const pos = sampleAt(
        stream.samples,
        performance.now() - INTERPOLATION_DELAY_MS,
      );
      if (pos) {
        const g = geometryRef.current;
        const left = (g.rowClueCols + pos.x) * g.cellSize;
        const top = (g.colClueRows + pos.y) * g.cellSize;
        el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        el.style.opacity = "1";
      } else {
        el.style.opacity = "0";
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stream, visible]);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        opacity: 0,
        pointerEvents: "none",
        zIndex: 5,
        willChange: "transform",
      }}
    >
      {/* Arrow with its tip at the element's origin. */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        style={{
          display: "block",
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))",
        }}
      >
        <path
          d="M1 1 L1 15 L5 11 L8 17 L10.5 16 L7.5 10 L13 10 Z"
          fill={color}
          stroke="#ffffff"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/**
 * Reports the local pointer, in board coordinates, while `enabled`. Sends at
 * most one position per SEND_INTERVAL_MS (the latest one wins), and null
 * whenever the pointer is no longer on the board — including on alt-tab or
 * a hidden tab, where pointerleave is not reliably fired.
 */
export function useTeammateCursorSender(
  boardRef: RefObject<HTMLElement | null>,
  geometry: BoardGeometry,
  enabled: boolean,
  send: (position: CursorPosition | null) => void,
) {
  const sendRef = useRef(send);
  const geometryRef = useRef(geometry);
  useEffect(() => {
    sendRef.current = send;
    geometryRef.current = geometry;
  }, [send, geometry]);

  useEffect(() => {
    const el = boardRef.current;
    if (!enabled || !el) return;

    let lastSentAt = 0;
    let pending: CursorPosition | null = null;
    let timer: number | undefined;
    let onBoard = false;

    const flush = () => {
      timer = undefined;
      if (!pending) return;
      lastSentAt = performance.now();
      sendRef.current(pending);
      pending = null;
    };

    const clear = () => {
      window.clearTimeout(timer);
      timer = undefined;
      pending = null;
      if (onBoard) sendRef.current(null);
      onBoard = false;
    };

    const onMove = (e: PointerEvent) => {
      const g = geometryRef.current;
      const rect = el.getBoundingClientRect();
      const totalCols = g.rowClueCols + g.width;
      const totalRows = g.colClueRows + g.height;
      // Measured as a fraction of the rendered size, so any CSS scaling of
      // the board cancels out.
      const x =
        ((e.clientX - rect.left) / rect.width) * totalCols - g.rowClueCols;
      const y =
        ((e.clientY - rect.top) / rect.height) * totalRows - g.colClueRows;
      if (x < 0 || x > g.width || y < 0 || y > g.height) {
        clear();
        return;
      }
      onBoard = true;
      pending = { x, y };
      const wait = SEND_INTERVAL_MS - (performance.now() - lastSentAt);
      if (wait <= 0) flush();
      else if (timer === undefined) timer = window.setTimeout(flush, wait);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") clear();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", clear);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", clear);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVisibility);
      clear();
    };
  }, [boardRef, enabled]);
}
