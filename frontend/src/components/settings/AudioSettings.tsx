import { useSettings } from "./SettingsContext";
import { SettingRow } from "./components/SettingRow";
import { SettingsToggle } from "./components/SettingsToggle";

export function AudioSettings() {
  const {
    volume,
    setVolume,
    cellFillSound,
    setCellFillSound,
    crossSound,
    setCrossSound,
  } = useSettings();

  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-ink)] font-ui">
        Audio
      </h2>

      <p className="mt-1 text-[14px] text-[var(--color-ink-muted)] font-ui">
        Control sounds while you play.
      </p>

      {/* Volume */}
      <div className="border-b border-[var(--color-line)] py-6">
        <div className="mb-3 flex items-center justify-between">
          <label
            htmlFor="settings-volume"
            className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-faint)] font-ui"
          >
            Volume
          </label>

          <span className="text-sm font-semibold text-[var(--color-ink)] font-ui">
            {volume}%
          </span>
        </div>

        <input
          id="settings-volume"
          type="range"
          min="0"
          max="100"
          step="1"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-full accent-[var(--color-blue-500)]"
          aria-label="Volume"
        />
      </div>

      <SettingRow
        title="Cell fill sound"
        description="Plays when you fill a cell."
      >
        <SettingsToggle
          checked={cellFillSound}
          onChange={setCellFillSound}
          label="Cell fill sound"
        />
      </SettingRow>

      <SettingRow
        title="Cross sound"
        description="Plays when you mark a cell empty."
        showDivider={false}
      >
        <SettingsToggle
          checked={crossSound}
          onChange={setCrossSound}
          label="Cross sound"
        />
      </SettingRow>
    </div>
  );
}