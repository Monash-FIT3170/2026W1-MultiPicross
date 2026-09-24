import { SettingRow } from "./components/SettingRow";
import { SettingsToggle } from "./components/SettingsToggle";
import { SettingsSelector } from "./components/SettingsSelector";
import { useSettings } from "./SettingsContext";

export function AppearanceSettings() {

  const {
    theme,
    setTheme,
    animationLevel,
    setAnimationLevel,
    cellFillPop,
    setCellFillPop,
    showOpponentProgress,
    setShowOpponentProgress,
  } = useSettings();

  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-ink)] font-ui">
        Appearance
      </h2>

      <p className="mt-1 text-[14px] text-[var(--color-ink-muted)] font-ui">
        How the board and the menus look.
      </p>

      <div className="mt-6 border-b border-[var(--color-line)] pb-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)] font-ui">
          Theme
        </p>

        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setTheme("light")}
            aria-pressed={theme === "light"}
            className={`rounded-xl border-2 p-3 text-left text-[var(--color-ink)] transition ${
              theme === "light"
                ? "border-[var(--color-blue-500)]"
                : "border-[var(--color-line)] hover:border-[var(--color-blue-200)]"
            }`}
          >
            <div className="flex h-12 items-center justify-center rounded-lg bg-[#F7F6F2]">
              <div className="flex gap-1">
                <span className="h-3 w-3 rounded-sm bg-[#3D5A80]" />
                <span className="h-3 w-3 rounded-sm bg-white" />
                <span className="h-3 w-3 rounded-sm bg-[#3D5A80]" />
              </div>
            </div>

            <span className="mt-2 block text-[13px] font-medium font-ui">
              Light
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTheme("dark")}
            aria-pressed={theme === "dark"}
            className={`rounded-xl border-2 p-3 text-left text-[var(--color-ink)] transition ${
              theme === "dark"
                ? "border-[var(--color-blue-500)]"
                : "border-[var(--color-line)] hover:border-[var(--color-blue-200)]"
            }`}
          >
            <div className="flex h-12 items-center justify-center rounded-lg bg-[#29292D]">
              <div className="flex gap-1">
                <span className="h-3 w-3 rounded-sm bg-[#B8D0EC]" />
                <span className="h-3 w-3 rounded-sm bg-[#484850]" />
                <span className="h-3 w-3 rounded-sm bg-[#B8D0EC]" />
              </div>
            </div>

            <span className="mt-2 block text-[13px] font-medium font-ui">
              Dark
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTheme("high-contrast")}
            aria-pressed={theme === "high-contrast"}
            className={`rounded-xl border-2 p-3 text-left text-[var(--color-ink)] transition ${
              theme === "high-contrast"
                ? "border-[var(--color-blue-500)]"
                : "border-[var(--color-line)] hover:border-[var(--color-blue-200)]"
            }`}
          >
            <div className="flex h-12 items-center justify-center rounded-lg border border-black bg-white">
              <div className="flex gap-1">
                <span className="h-3 w-3 rounded-sm bg-black" />
                <span className="h-3 w-3 rounded-sm border border-black bg-white" />
                <span className="h-3 w-3 rounded-sm bg-black" />
              </div>
            </div>

            <span className="mt-2 block text-[13px] font-medium font-ui">
              High Contrast
            </span>
          </button>
        </div>
      </div>

      <div>
        <SettingRow
          title="Animations"
          description="Show cell pops, win banners, menu transitions."
        >
          <SettingsSelector
            options={["Full", "Subtle", "Off"]}
            value={
              animationLevel === "full"
                ? "Full"
                : animationLevel === "subtle"
                  ? "Subtle"
                  : "Off"
            }
            onChange={(value) =>
              setAnimationLevel(value.toLowerCase() as "full" | "subtle" | "off")
            }
            label="Animation level"
          />
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