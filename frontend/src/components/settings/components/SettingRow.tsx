import type { ReactNode } from "react";

type SettingRowProps = {
  title: string;
  description: string;
  children: ReactNode;
  showDivider?: boolean;
};

export function SettingRow({
  title,
  description,
  children,
  showDivider = true,
}: SettingRowProps) {
  return (
    <div
      className={`flex items-center justify-between gap-6 py-4 ${
        showDivider ? "border-b border-[var(--color-line)]" : ""
      }`}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-[var(--color-ink)] font-ui">
          {title}
        </h3>

        <p className="mt-1 text-[14px] text-[var(--color-ink-muted)] font-ui">
          {description}
        </p>
      </div>

      <div className="shrink-0">{children}</div>
    </div>
  );
}
