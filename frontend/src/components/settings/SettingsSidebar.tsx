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
  { id: "account", label: "Account" },
];

export function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  return (
    <nav className="flex w-48 flex-col gap-2">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onSectionChange(section.id)}
          className={`rounded-lg px-4 py-3 text-left transition ${
            activeSection === section.id
              ? "bg-gray-200 font-semibold"
              : "hover:bg-gray-100"
          }`}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}