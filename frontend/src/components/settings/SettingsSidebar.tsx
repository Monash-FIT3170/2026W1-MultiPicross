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

const getButtonClass = (isActive: boolean) =>
  `rounded-lg border px-4 py-3 text-left text-sm font-ui transition ${
    isActive
      ? "border-[#B8D0EC] bg-[#EAF2FB] font-semibold"
      : "border-transparent font-normal hover:border-[#B8D0EC] hover:bg-[#F0EEE9]"
  }`;

export function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  return (
    <nav className="flex h-full w-48 flex-col">
      <div className="flex flex-col gap-1">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onSectionChange(section.id)}
            className={getButtonClass(activeSection === section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onSectionChange("account")}
        className={`mt-auto ${getButtonClass(activeSection === "account")}`}
      >
        Account
      </button>
    </nav>
  );
}