import {
  memo,
  useCallback,
  useDeferredValue,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  useCollection,
  type CollectionPuzzle,
  type SolveMode,
} from "../api/collection";
import { PuzzleArt, type ArtView } from "../components/PuzzleArt";
import { RangeSlider } from "../components/RangeSlider";
import { fmtSeconds } from "../components/NonogramGrid";
import { SettingsSelector } from "../components/settings/components/SettingsSelector";
import {
  BackButton,
  Button,
  Chip,
  Icon,
  LivesPips,
  Logo,
  ToggleChip,
  UserDropdown,
  useDialogFocus,
} from "../components/ui";

type SortKey = "recent" | "fastest" | "most" | "name" | "size";
type SortDir = "asc" | "desc";

const collator = new Intl.Collator();

const SORTS: {
  key: SortKey;
  label: string;
  first: SortDir;
  compare: (a: CollectionPuzzle, b: CollectionPuzzle) => number;
}[] = [
  {
    key: "recent",
    label: "Recently solved",
    first: "desc",
    compare: (a, b) =>
      a.lastCompletedAt < b.lastCompletedAt
        ? -1
        : a.lastCompletedAt > b.lastCompletedAt
          ? 1
          : 0,
  },
  {
    key: "fastest",
    label: "Fastest time",
    first: "asc",
    compare: (a, b) => a.fastestSeconds - b.fastestSeconds,
  },
  {
    key: "most",
    label: "Most solved",
    first: "desc",
    compare: (a, b) => a.timesSolved - b.timesSolved,
  },
  {
    key: "name",
    label: "Name",
    first: "asc",
    compare: (a, b) => collator.compare(displayName(a), displayName(b)),
  },
  {
    key: "size",
    label: "Size",
    first: "desc",
    compare: (a, b) => a.width * a.height - b.width * b.height,
  },
];

const TIME_STEP = 15;
const TIME_LIMIT = 600;
// The slider's last stop past 10:00 means no upper bound.
const TIME_INF = TIME_LIMIT + TIME_STEP;

const MODES: { key: SolveMode; label: string; tone: "blue" | "lavender" }[] = [
  { key: "singleplayer", label: "Singleplayer", tone: "blue" },
  { key: "multiplayer", label: "Multiplayer", tone: "lavender" },
];

const MAX_LIVES = 3;
const VIEW_KEY = "collection-view";

function readView(): ArtView {
  try {
    return localStorage.getItem(VIEW_KEY) === "picture" ? "picture" : "grid";
  } catch {
    return "grid";
  }
}
const MODAL_CLOSE_MS = 320;

function displayName(p: CollectionPuzzle): string {
  return p.name ?? "Untitled puzzle";
}

function sizeKey(p: CollectionPuzzle): string {
  return `${p.width}x${p.height}`;
}

function timeLabel(seconds: number): ReactNode {
  return seconds === TIME_INF ? <>&infin;</> : fmtSeconds(seconds);
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function cellSize(
  p: CollectionPuzzle,
  steps: [number, number, number, number],
) {
  const side = Math.max(p.width, p.height);
  if (side <= 5) return steps[0];
  if (side <= 10) return steps[1];
  if (side <= 15) return steps[2];
  return steps[3];
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function Collection() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const collection = useCollection();

  const [sizes, setSizes] = useState<string[]>([]);
  const [modes, setModes] = useState<SolveMode[]>([]);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, TIME_INF]);
  const [sort, setSort] = useState<SortKey>("recent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<ArtView>(readView);
  const [selected, setSelected] = useState<{
    puzzle: CollectionPuzzle;
    from: DOMRect;
  } | null>(null);
  const [closing, setClosing] = useState(false);

  const puzzles = useMemo(
    () => (collection.status === "ready" ? collection.puzzles : []),
    [collection],
  );

  const sizeOptions = useMemo(() => {
    const seen = new Map(puzzles.map((p) => [sizeKey(p), p]));
    return [...seen.values()]
      .sort((a, b) => a.width * a.height - b.width * b.height)
      .map((p) => ({
        key: sizeKey(p),
        label: (
          <>
            {p.width} &times; {p.height}
          </>
        ),
      }));
  }, [puzzles]);

  // Defer slider drags so the grid re-filters after the thumb, not on every step.
  const filterRange = useDeferredValue(timeRange);
  const openPuzzle = useCallback(
    (puzzle: CollectionPuzzle, from: DOMRect) => setSelected({ puzzle, from }),
    [],
  );

  const visible = useMemo(() => {
    const spec = SORTS.find((s) => s.key === sort)!;
    const dir = sortDir === "asc" ? 1 : -1;
    return puzzles
      .filter(
        (p) =>
          (sizes.length === 0 || sizes.includes(sizeKey(p))) &&
          (modes.length === 0 || p.modes.some((m) => modes.includes(m))) &&
          p.fastestSeconds >= filterRange[0] &&
          (filterRange[1] === TIME_INF || p.fastestSeconds <= filterRange[1]),
      )
      .sort((a, b) => spec.compare(a, b) * dir);
  }, [puzzles, sizes, modes, filterRange, sort, sortDir]);

  const timeFiltered = timeRange[0] > 0 || timeRange[1] < TIME_INF;
  const filterCount = sizes.length + modes.length + (timeFiltered ? 1 : 0);
  const total = puzzles.length;

  function clearFilters() {
    setSizes([]);
    setModes([]);
    setTimeRange([0, TIME_INF]);
  }

  // Animating the sidebar's width reflows the grid every frame, so the layout
  // switches in one step and a view transition glides the cards instead.
  function toggleFilters() {
    const flip = () => flushSync(() => setFiltersOpen((o) => !o));
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!document.startViewTransition || reduced) flip();
    else document.startViewTransition(flip);
  }

  function changeView(next: ArtView) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the choice just won't persist.
    }
  }

  function pickSort(key: SortKey) {
    if (key === sort) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSort(key);
      setSortDir(SORTS.find((s) => s.key === key)!.first);
    }
  }

  function closeModal() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setSelected(null);
      setClosing(false);
    }, MODAL_CLOSE_MS);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-paper)",
        fontFamily: "var(--font-ui)",
        color: "var(--color-ink)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="mp-main-topbar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 20,
          gap: 12,
        }}
      >
        <Logo size={28} />
        <UserDropdown
          handle={user?.handle ?? null}
          onSignOut={() => void logout()}
        />
      </div>

      <div className="col-layout">
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <BackButton label="Back" onClick={() => navigate("/")} />
            <h1
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 700,
                color: "var(--color-ink)",
                letterSpacing: "-0.015em",
              }}
            >
              Collection
            </h1>
            {collection.status === "ready" && (
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "var(--color-ink-muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {total} {total === 1 ? "puzzle" : "puzzles"} solved
                {total > 0 && <> &middot; showing {visible.length}</>}
              </p>
            )}
          </div>
          {total > 0 && <ViewToggle view={view} onChange={changeView} />}
        </div>
        <div className="col-body">
          <main style={{ flex: 1, minWidth: 0 }}>
            {collection.status === "loading" && (
              <StatusPanel>
                <Icon name="refresh" size={18} color="var(--color-ink-faint)" />
                <span style={{ color: "var(--color-ink-faint)" }}>
                  Loading&hellip;
                </span>
              </StatusPanel>
            )}

            {collection.status === "error" && (
              <StatusPanel>
                <Icon name="info" size={32} color="var(--color-coral-400)" />
                <p style={{ margin: 0, color: "var(--color-ink-muted)" }}>
                  Couldn't load your collection. Please try again later.
                </p>
              </StatusPanel>
            )}

            {collection.status === "ready" && total === 0 && (
              <StatusPanel>
                <Icon
                  name="grid"
                  size={44}
                  color="var(--color-line-strong)"
                  strokeWidth={1.6}
                />
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  No solved puzzles yet
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: "var(--color-ink-muted)",
                    maxWidth: 320,
                  }}
                >
                  Puzzles you complete will show up here.
                </p>
                <Button
                  style={{ marginTop: 6 }}
                  onClick={() => navigate("/singleplayer")}
                >
                  Singleplayer
                </Button>
              </StatusPanel>
            )}

            {collection.status === "ready" &&
              total > 0 &&
              visible.length === 0 && (
                <StatusPanel>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    No puzzles match these filters.
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </StatusPanel>
              )}

            {visible.length > 0 && (
              <div className="col-grid">
                {visible.map((p, i) => (
                  <CollectionCard
                    key={p.id}
                    puzzle={p}
                    index={i}
                    view={view}
                    onOpen={openPuzzle}
                  />
                ))}
              </div>
            )}
          </main>
          <div
            className="col-sidebar-wrap"
            data-open={filtersOpen}
            aria-hidden={!filtersOpen}
            inert={!filtersOpen}
          >
            <aside className="col-sidebar mp-surface">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700 }}>Filters</span>
                <Button variant="text" size="sm" onClick={clearFilters}>
                  Clear
                </Button>
              </div>

              <FilterGroup label="Size">
                {sizeOptions.map((o) => (
                  <ToggleChip
                    key={o.key}
                    active={sizes.includes(o.key)}
                    onClick={() => setSizes((l) => toggle(l, o.key))}
                  >
                    {o.label}
                  </ToggleChip>
                ))}
              </FilterGroup>

              <FilterGroup label="Mode">
                {MODES.map((m) => (
                  <ToggleChip
                    key={m.key}
                    active={modes.includes(m.key)}
                    onClick={() => setModes((l) => toggle(l, m.key))}
                  >
                    {m.label}
                  </ToggleChip>
                ))}
              </FilterGroup>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div className="range-slider-header">
                  <span className="mp-eyebrow">Best time</span>
                  <span className="range-slider-values">
                    {timeLabel(timeRange[0])} &ndash; {timeLabel(timeRange[1])}
                  </span>
                </div>
                <RangeSlider
                  min={0}
                  max={TIME_INF}
                  step={TIME_STEP}
                  value={timeRange}
                  onChange={setTimeRange}
                  labels={["Minimum best time", "Maximum best time"]}
                  valueText={(v) =>
                    v === TIME_INF ? "No limit" : fmtSeconds(v)
                  }
                />
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <span className="mp-eyebrow">Sort by</span>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  {SORTS.map((o) => {
                    const active = sort === o.key;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        className="col-sort-option"
                        aria-pressed={active}
                        onClick={() => pickSort(o.key)}
                      >
                        <span
                          style={{ width: 14, display: "inline-flex" }}
                          role="img"
                          aria-label={
                            active
                              ? sortDir === "asc"
                                ? "Ascending"
                                : "Descending"
                              : undefined
                          }
                        >
                          {active && (
                            <Icon
                              name="arrow-down"
                              size={14}
                              strokeWidth={2.5}
                              style={{
                                transform:
                                  sortDir === "asc" ? "rotate(180deg)" : "none",
                                transition: "transform 200ms var(--ease-out)",
                              }}
                            />
                          )}
                        </span>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {total > 0 && (
        <button
          type="button"
          className="col-filter-pill"
          aria-expanded={filtersOpen}
          onClick={toggleFilters}
        >
          <Icon name="filter" size={18} />
          {filtersOpen ? "Hide filters" : "Filter"}
          {filterCount > 0 && (
            <span className="col-filter-count">{filterCount}</span>
          )}
        </button>
      )}

      {selected && (
        <PuzzleModal
          puzzle={selected.puzzle}
          from={selected.from}
          closing={closing}
          view={view}
          onViewChange={changeView}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

const CollectionCard = memo(function CollectionCard({
  puzzle: p,
  index,
  view,
  onOpen,
}: {
  puzzle: CollectionPuzzle;
  index: number;
  view: ArtView;
  onOpen: (puzzle: CollectionPuzzle, from: DOMRect) => void;
}) {
  return (
    <button
      type="button"
      className="tile col-card"
      style={{
        animationDelay: `${Math.min(index, 24) * 18}ms`,
        viewTransitionName: `col-card-${p.id}`,
      }}
      onClick={(e) => onOpen(p, e.currentTarget.getBoundingClientRect())}
    >
      <div className="col-art-frame" style={{ aspectRatio: "1 / 1" }}>
        <PuzzleArt
          solution={p.solution}
          colors={p.colors}
          view={view}
          width={p.width}
          height={p.height}
          cellSize={cellSize(p, [18, 10, 7, 5])}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayName(p)}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "var(--color-ink-faint)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {p.width} &times; {p.height}
          <span style={{ color: "var(--color-line)" }}>&middot;</span>
          {p.timesSolved === 1 ? (
            "solved once"
          ) : (
            <>solved {p.timesSolved}&times;</>
          )}
        </span>
      </div>
    </button>
  );
});

function ViewToggle({
  view,
  onChange,
}: {
  view: ArtView;
  onChange: (view: ArtView) => void;
}) {
  return (
    <SettingsSelector
      label="Art view"
      options={["Grid", "Picture"]}
      value={view === "grid" ? "Grid" : "Picture"}
      onChange={(v) => onChange(v === "Picture" ? "picture" : "grid")}
    />
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span className="mp-eyebrow">{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function StatusPanel({ children }: { children: ReactNode }) {
  return (
    <div
      className="mp-surface"
      style={{
        padding: "64px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

function fromCard(from: DOMRect, to: DOMRect): string {
  const sx = Math.max(0.2, from.width / to.width);
  const sy = Math.max(0.2, from.height / to.height);
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`;
}

function PuzzleModal({
  puzzle,
  from,
  closing,
  view,
  onViewChange,
  onClose,
}: {
  puzzle: CollectionPuzzle;
  from: DOMRect;
  closing: boolean;
  view: ArtView;
  onViewChange: (view: ArtView) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restRect = useRef<DOMRect | null>(null);
  useDialogFocus(panelRef, onClose);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    restRect.current = el.getBoundingClientRect();
    el.style.transition = "none";
    el.style.transform = fromCard(from, restRect.current);
    el.style.opacity = "0.4";
    void el.offsetWidth;
    el.style.transition = "";
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        el.style.transform = "";
        el.style.opacity = "";
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [from]);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!closing || !el || !restRect.current) return;
    el.style.transform = fromCard(from, restRect.current);
    el.style.opacity = "0";
  }, [closing, from]);

  const titleId = `col-modal-${puzzle.id}`;
  const compact = window.matchMedia("(max-width: 768px)").matches;

  return (
    <div className="col-modal-root">
      <div
        className="col-modal-scrim"
        onClick={onClose}
        style={{ opacity: closing ? 0 : 1 }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="col-modal"
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            alignItems: "center",
          }}
        >
          <div
            className="col-art-frame"
            style={{ padding: 14, borderRadius: 12 }}
          >
            <PuzzleArt
              solution={puzzle.solution}
              colors={puzzle.colors}
              view={view}
              width={puzzle.width}
              height={puzzle.height}
              cellSize={cellSize(
                puzzle,
                compact ? [30, 18, 12, 9] : [42, 26, 18, 14],
              )}
            />
          </div>
          <span
            className="mp-eyebrow"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {puzzle.width} &times; {puzzle.height}
          </span>
          <ViewToggle view={view} onChange={onViewChange} />
        </div>

        <div className="col-modal-details">
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h2
                id={titleId}
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 700,
                  color: "var(--color-ink)",
                  letterSpacing: "-0.01em",
                }}
              >
                {displayName(puzzle)}
              </h2>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {MODES.filter((m) => puzzle.modes.includes(m.key)).map((m) => (
                  <Chip key={m.key} tone={m.tone}>
                    {m.label}
                  </Chip>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="col-close"
              onClick={onClose}
              aria-label="Close"
            >
              <Icon name="x" size={14} color="var(--color-ink-muted)" />
            </button>
          </div>

          <div className="col-modal-stats">
            <ModalStat label="Fastest" accent>
              {fmtSeconds(puzzle.fastestSeconds)}
            </ModalStat>
            <ModalStat label="Average">
              {fmtSeconds(puzzle.averageSeconds)}
            </ModalStat>
            <ModalStat label="Solved">{puzzle.timesSolved}</ModalStat>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              ["First completed", formatDate(puzzle.firstCompletedAt)],
              ["Last completed", formatDate(puzzle.lastCompletedAt)],
              ["Total time played", fmtSeconds(puzzle.totalSeconds)],
            ].map(([label, value]) => (
              <div key={label} className="col-modal-row">
                <span style={{ color: "var(--color-ink-muted)" }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: "auto",
              paddingTop: 20,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span className="mp-eyebrow">Best Solve</span>
            <LivesPips lives={puzzle.bestLivesLeft} max={MAX_LIVES} size={12} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalStat({
  label,
  accent = false,
  children,
}: {
  label: string;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="mp-eyebrow">{label}</span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: accent ? "var(--color-logo)" : "var(--color-ink)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {children}
      </span>
    </div>
  );
}
