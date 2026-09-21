import { SettingRow } from "./components/SettingRow";

export function AppearanceSettings() {
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
          <button
            type="button"
            className="rounded-lg border border-[#E7E4DC] px-4 py-2 font-ui text-sm"
          >
            Toggle
          </button>
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
          <button
            type="button"
            className="rounded-lg border border-[#E7E4DC] px-4 py-2 font-ui text-sm"
          >
            Toggle
          </button>
        </SettingRow>

        <SettingRow
          title="Show opponent progress"
          description="Show cells your opponent has filled."
          showDivider={false}
        >
          <button
            type="button"
            className="rounded-lg border border-[#E7E4DC] px-4 py-2 font-ui text-sm"
          >
            Toggle
          </button>
        </SettingRow>
      </div>
    </div>
  );
}