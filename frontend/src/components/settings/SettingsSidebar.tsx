export type SettingsSection =
  | "profile"
  | "appearance"
  | "gameplay"
  | "audio"
  | "accessibility"
  | "account";

type SettingsSidebarProps = {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
};

const sections: { id: SettingsSection; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "appearance", label: "Appearance" },
  { id: "gameplay", label: "Gameplay" },
  { id: "audio", label: "Audio" },
  { id: "accessibility", label: "Accessibility" },
];

export function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  return (
    <nav className="flex h-full w-48 flex-col">
      {/* Main categories */}
      <div className="flex flex-col gap-1">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onSectionChange(section.id)}
            className={`rounded-lg px-4 py-3 text-left text-sm font-ui transition ${
              activeSection === section.id
                ? "bg-[#F0EEE9] font-semibold"
                : "font-normal hover:bg-[#F4F2EE]"
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Account pinned to bottom */}
      <button
        type="button"
        onClick={() => onSectionChange("account")}
        className={`mt-auto rounded-lg px-4 py-3 text-left text-sm font-ui transition ${
          activeSection === "account"
            ? "bg-[#F0EEE9] font-semibold"
            : "font-normal hover:bg-[#F4F2EE]"
        }`}
      >
        Account
      </button>
    </nav>
  );
}