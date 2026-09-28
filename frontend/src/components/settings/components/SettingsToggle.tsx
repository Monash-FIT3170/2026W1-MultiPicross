type SettingsToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

export function SettingsToggle({
  checked,
  onChange,
  label,
}: SettingsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-14 items-center justify-center rounded-lg"
    >
      <span
        className={`flex h-7 w-12 items-center rounded-full p-1 transition ${
          checked
            ? "bg-[var(--color-blue-500)]"
            : "bg-[var(--color-line-strong)]"
        }`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-[var(--color-surface)] transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
