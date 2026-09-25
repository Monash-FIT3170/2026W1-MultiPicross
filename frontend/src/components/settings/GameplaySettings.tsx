import { useSettings } from "./SettingsContext";
import { SettingRow } from "./components/SettingRow";
import { SettingsSelector } from "./components/SettingsSelector";

export function GameplaySettings() {
  const { primaryClick, setPrimaryClick } = useSettings();

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
          showDivider={false}
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
      </div>
    </div>
  );
}