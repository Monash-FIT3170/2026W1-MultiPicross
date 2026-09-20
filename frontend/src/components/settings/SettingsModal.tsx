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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative w-[850px] max-w-[95vw] rounded-xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={closeSettings}
          className="absolute right-4 top-4"
          aria-label="Close settings"
        >
          ×
        </button>

        <h1 className="text-3xl font-bold">Settings</h1>

        <div className="mt-6 flex gap-6">
          <SettingsSidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />

          <main className="flex-1">
            {activeSection === "profile" && <ProfileSettings />}

            {activeSection === "appearance" && (
              <AppearanceSettings />
            )}

            {activeSection === "gameplay" && (
              <GameplaySettings />
            )}

            {activeSection === "audio" && <AudioSettings />}

            {activeSection === "accessibility" && (
              <AccessibilitySettings />
            )}

            {activeSection === "account" && (
              <AccountSettings />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}