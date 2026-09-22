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
      className="flex rounded-full bg-[#F0EEE9] p-0.5"
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
                ? "bg-white font-medium text-[#3D5A80] shadow-sm"
                : "text-[#6B6B6B] hover:text-black"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}