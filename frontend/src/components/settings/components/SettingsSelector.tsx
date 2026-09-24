type SettingsSelectorProps = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
};

export function SettingsSelector({
  options,
  value,
  onChange,
  label,
}: SettingsSelectorProps) {
  return (
    <div
      className="flex rounded-full bg-[var(--color-surface-sunk)] p-0.5"
      role="group"
      aria-label={label}
    >
      {options.map((option) => {
        const isSelected = value === option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={isSelected}
            className={`min-h-8 rounded-full px-3 text-[13px] font-ui transition ${
              isSelected
                ? "bg-[var(--color-surface)] font-medium text-[var(--color-blue-500)] shadow-sm"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}