// Must stay in step with HandleBody in api/src/auth/routes.ts. Diverging means
// the client rejects input the server accepts, or shows a 400 the user cannot act on.
export const HANDLE_PATTERN = /^[a-zA-Z0-9_-]{3,20}$/;

export const HANDLE_RULE =
  "Handles are 3 to 20 characters: letters, numbers, underscores and hyphens only";

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

export const handleInputCls =
  "rounded-xl border border-[var(--color-line)] px-4 py-2 text-sm outline-none focus:border-[var(--color-accent-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)]/20 bg-[var(--color-surface)]";

export const handleLabelCls = "text-sm font-medium text-[var(--color-ink)]";
