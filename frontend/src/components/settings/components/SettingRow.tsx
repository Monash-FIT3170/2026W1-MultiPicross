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
        showDivider ? "border-b border-[#E7E4DC]" : ""
      }`}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-black font-ui">
            {title}
        </h3>

        <p className="mt-1 text-[14px] text-[#6B6B6B] font-ui">
            {description}
        </p>
      </div>

      <div className="shrink-0">{children}</div>
    </div>
  );
}