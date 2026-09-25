import { useSettings } from "./SettingsContext";
import { SettingRow } from "./components/SettingRow";
import { SettingsToggle } from "./components/SettingsToggle";

export function AccessibilitySettings() {
  const {
    reducedMotion,
    setReducedMotion,
    largerClueNumbers,
    setLargerClueNumbers,
    boldGridLines,
    setBoldGridLines,
  } = useSettings();

  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-ink)] font-ui">
        Accessibility
      </h2>

      <p className="mt-1 text-[14px] text-[var(--color-ink-muted)] font-ui">
        Adjust the game to make it easier and more comfortable to use.
      </p>

      <div className="mt-4">
        <SettingRow
          title="Reduced motion"
          description="Reduce animations and motion effects."
        >
          <SettingsToggle
            checked={reducedMotion}
            onChange={setReducedMotion}
            label="Reduced motion"
          />
        </SettingRow>

        <SettingRow
          title="Larger clue numbers"
          description="Increase the size of clue numbers on the puzzle grid."
        >
          <SettingsToggle
            checked={largerClueNumbers}
            onChange={setLargerClueNumbers}
            label="Larger clue numbers"
          />
        </SettingRow>

        <SettingRow
          title="Bold grid lines"
          description="Make puzzle grid lines thicker and easier to see."
          showDivider={false}
        >
          <SettingsToggle
            checked={boldGridLines}
            onChange={setBoldGridLines}
            label="Bold grid lines"
          />
        </SettingRow>
      </div>
    </div>
  );
}