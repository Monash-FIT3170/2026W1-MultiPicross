import { useSettings } from "./SettingsContext";
import { SettingRow } from "./components/SettingRow";
import { SettingsSelector } from "./components/SettingsSelector";
import { SettingsToggle } from "./components/SettingsToggle";

export function GameplaySettings() {
  const {
    primaryClick,
    setPrimaryClick,
    dragToFill,
    setDragToFill,
  } = useSettings();

  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-ink)] font-ui">
        Gameplay
      </h2>

      <p className="mt-1 text-[14px] text-[var(--color-ink-muted)] font-ui">
        Customize how you interact with the puzzle.
      </p>

      <div className="mt-2">
        <SettingRow
          title="Primary click"
          description="Choose what happens when you click a cell."
        >
          <SettingsSelector
            options={["Fill", "Cross"]}
            value={primaryClick === "fill" ? "Fill" : "Cross"}
            onChange={(value) =>
              setPrimaryClick(value === "Fill" ? "fill" : "cross")
            }
            label="Primary click action"
          />
        </SettingRow>

        <SettingRow
          title="Drag to fill"
          description="Fill multiple cells by clicking and dragging."
          showDivider={false}
        >
          <SettingsToggle
            checked={dragToFill}
            onChange={setDragToFill}
            label="Drag to fill"
          />
        </SettingRow>
      </div>
    </div>
  );
}