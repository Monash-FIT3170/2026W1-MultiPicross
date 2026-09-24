import profileIcon from "../../assets/settings/profile.svg";
import appearanceIcon from "../../assets/settings/appearance.svg";
import gameplayIcon from "../../assets/settings/gameplay.svg";
import audioIcon from "../../assets/settings/audio.svg";
import accessibilityIcon from "../../assets/settings/accessibility.svg";
import accountIcon from "../../assets/settings/account.svg";

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

const getButtonClass = (isActive: boolean) =>
  `rounded-lg border px-3 py-3 text-left text-sm font-ui transition ${
    isActive
      ? "border-[var(--color-blue-200)] bg-[var(--color-blue-50)] text-[var(--color-blue-500)] font-bold hover:-translate-y-px"
      : "border-transparent text-[var(--color-ink-muted)] font-semibold hover:-translate-y-px hover:border-[var(--color-blue-200)] hover:bg-[var(--color-surface-sunk)]"
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
            <span className="flex items-center gap-3">
              <img
                src={section.icon}
                alt=""
                aria-hidden="true"
                className="h-4 w-4 shrink-0 opacity-60"
              />
              <span>{section.label}</span>
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onSectionChange("account")}
        className={`mt-auto ${getButtonClass(activeSection === "account")}`}
      >
        <span className="flex items-center gap-3">
          <img
            src={accountIcon}
            alt=""
            aria-hidden="true"
            className="h-4 w-4 shrink-0 opacity-60"
          />
          <span>Account</span>
        </span>
      </button>
    </nav>
  );
}