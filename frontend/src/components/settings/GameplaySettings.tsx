import { useSettings } from "./SettingsContext";
import { SettingRow } from "./components/SettingRow";
import { SettingsToggle } from "./components/SettingsToggle";

export function GameplaySettings() {
  const {
    primaryClick,
    setPrimaryClick,
    dragToFill,
    setDragToFill,
    autoCrossSolvedLines,
    setAutoCrossSolvedLines,
    confirmBeforeAbandoning,
    setConfirmBeforeAbandoning,
  } = useSettings();

  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-ink)] font-ui">
        Gameplay
      </h2>

      <p className="mt-1 text-[14px] text-[var(--color-ink-muted)] font-ui">
        Customize how you interact with the puzzle.
      </p>

      <div className="mt-6">
        <div className="border-b border-[var(--color-line)] pb-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--color-ink-faint)] font-ui">
            Primary click
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPrimaryClick("fill")}
              aria-pressed={primaryClick === "fill"}
              className={`
                min-h-[80px] rounded-xl border-2 px-4 py-2
                text-left font-ui transition
                ${
                  primaryClick === "fill"
                    ? "border-[var(--color-blue-500)] bg-[var(--color-surface)]"
                    : "border-[var(--color-line)] bg-[var(--color-surface)]"
                }
              `}
            >
              <span className="block text-sm font-semibold text-[var(--color-ink)]">
                Fill
              </span>

              <span className="mt-1 block text-[13px] text-[var(--color-ink-muted)]">
                Right-click marks empty.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPrimaryClick("cross")}
              aria-pressed={primaryClick === "cross"}
              className={`
                min-h-[80px] rounded-xl border-2 px-4 py-2
                text-left font-ui transition
                ${
                  primaryClick === "cross"
                    ? "border-[var(--color-blue-500)] bg-[var(--color-surface)]"
                    : "border-[var(--color-line)] bg-[var(--color-surface)]"
                }
              `}
            >
              <span className="block text-sm font-semibold text-[var(--color-ink)]">
                Cross
              </span>

              <span className="mt-1 block text-[13px] text-[var(--color-ink-muted)]">
                Right-click fills.
              </span>
            </button>
          </div>
        </div>

        <SettingRow
          title="Drag to fill"
          description="Fill multiple cells by clicking and dragging."
        >
          <SettingsToggle
            checked={dragToFill}
            onChange={setDragToFill}
            label="Drag to fill"
          />
        </SettingRow>

        <SettingRow
          title="Auto-cross solved lines"
          description="Cross the rest of a row once its clues are met."
        >
          <SettingsToggle
            checked={autoCrossSolvedLines}
            onChange={setAutoCrossSolvedLines}
            label="Auto-cross solved lines"
          />
        </SettingRow>

        <SettingRow
          title="Confirm before abandoning"
          description="Ask before you leave a game in progress."
          showDivider={false}
        >
          <SettingsToggle
            checked={confirmBeforeAbandoning}
            onChange={setConfirmBeforeAbandoning}
            label="Confirm before abandoning"
          />
        </SettingRow>
      </div>
    </div>
  );
}