import { useSettings } from "./SettingsContext";

export function SettingsModal() {

  const { isOpen, closeSettings } = useSettings();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative w-[850px] max-w-[95vw] rounded-xl bg-white p-6 shadow-xl">
        <button
          onClick={closeSettings}
          className="absolute right-4 top-4"
          aria-label="Close settings"
        >
          ×
        </button>

        <h1>Settings</h1>

        {/* SettingsSidebar */}
      </div>
    </div>
  );
}