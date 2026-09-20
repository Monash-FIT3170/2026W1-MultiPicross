import { useState } from "react";
import { useSettings } from "./SettingsContext";
import {
  SettingsSidebar,
  type SettingsSection,
} from "./SettingsSidebar";

import { ProfileSettings } from "./ProfileSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { GameplaySettings } from "./GameplaySettings";
import { AudioSettings } from "./AudioSettings";
import { AccessibilitySettings } from "./AccessibilitySettings";
import { AccountSettings } from "./AccountSettings";

export function SettingsModal() {
  const { isOpen, closeSettings } = useSettings();
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("profile");

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div
        className="
          flex h-[640px] w-[896px] max-h-[90vh] max-w-[95vw]
          flex-col overflow-hidden
          rounded-2xl
          border border-[#E7E4DC]
          bg-white
          shadow-xl
        "
      >
        <header
          className="
            flex h-16 items-center justify-between
            border-b-2 border-[#E7E4DC]
            px-8
          "
        >
          <h1
            id="settings-title"
            className="text-xl font-bold tracking-[0.02em] font-ui"
          >
            Settings
          </h1>

          <button
            type="button"
            onClick={closeSettings}
            className="
              flex h-8 w-8
              items-center justify-center
              rounded-lg
              text-lg
              hover:bg-[#F0EEE9]
            "
            aria-label="Close settings"
          >
            ×
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside
            className="
              flex w-56 shrink-0 flex-col
              border-r-2 border-[#E7E4DC]
              bg-[#F7F6F2]
              p-4
            "
          >
            <SettingsSidebar
              activeSection={activeSection}
              onSectionChange={setActiveSection}
            />
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto bg-white p-8">
            {activeSection === "profile" && <ProfileSettings />}
            {activeSection === "appearance" && <AppearanceSettings />}
            {activeSection === "gameplay" && <GameplaySettings />}
            {activeSection === "audio" && <AudioSettings />}
            {activeSection === "accessibility" && <AccessibilitySettings />}
            {activeSection === "account" && <AccountSettings />}
          </main>
        </div>
      </div>
    </div>
  );
}