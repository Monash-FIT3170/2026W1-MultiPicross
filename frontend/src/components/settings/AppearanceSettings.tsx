import { useState } from "react";
import { SettingRow } from "./components/SettingRow";
import { SettingsToggle } from "./components/SettingsToggle";

export function AppearanceSettings() {

  const [highContrast, setHighContrast] = useState(false);
  const [cellFillPop, setCellFillPop] = useState(true);
  const [showOpponentProgress, setShowOpponentProgress] = useState(true);

  return (
    <div>
      <h2 className="text-xl font-bold font-ui">Appearance</h2>
      <p className="mt-1 text-[14px] text-[#6B6B6B] font-ui">
        How the board and the menus look.
      </p>

      <div className="mt-4">
        <SettingRow
          title="High contrast"
          description="Increase contrast between interface elements."
        >
          <SettingsToggle
            checked={highContrast}
            onChange={setHighContrast}
            label="High contrast"
          />
        </SettingRow>

        <SettingRow
          title="Animations"
          description="Show cell pops, win banners, menu transitions."
        >
          <button
            type="button"
            className="rounded-lg border border-[#E7E4DC] px-4 py-2 font-ui text-sm"
          >
            Full
          </button>
        </SettingRow>

        <SettingRow
          title="Cell fill pop"
          description="A small scale bounce when a fill is correct."
        >
          <SettingsToggle
            checked={cellFillPop}
            onChange={setCellFillPop}
            label="Cell fill pop"
          />
        </SettingRow>

        <SettingRow
          title="Show opponent progress"
          description="Show cells your opponent has filled."
          showDivider={false}
        >
          <SettingsToggle
            checked={showOpponentProgress}
            onChange={setShowOpponentProgress}
            label="Show opponent progress"
          />
        </SettingRow>
      </div>
    </div>
  );
}