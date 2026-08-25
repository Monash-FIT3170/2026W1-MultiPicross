const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getCsrfToken(): string | null {
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith("csrf_token="));
  return match ? decodeURIComponent(match.slice("csrf_token=".length)) : null;
}

let refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const csrf = getCsrfToken();
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "same-origin",
    headers: csrf ? { "X-CSRF-Token": csrf } : {},
  });
  return res.ok;
}

function startRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

let onLogout: (() => void) | null = null;

export function setLogoutHandler(fn: () => void) {
  onLogout = fn;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (UNSAFE_METHODS.has(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers,
  });

  if (res.status === 401 && path !== "/auth/refresh") {
    const ok = await startRefresh();
    if (ok) {
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set("Content-Type", "application/json");
      if (UNSAFE_METHODS.has(method)) {
        const csrf = getCsrfToken();
        if (csrf) retryHeaders.set("X-CSRF-Token", csrf);
      }
      return fetch(`/api${path}`, {
        ...init,
        credentials: "same-origin",
        headers: retryHeaders,
      });
    }
    onLogout?.();
  }

  return res;
}

export async function parseApiError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (Array.isArray(body.error)) return body.error.join(", ");
    if (typeof body.error === "string") return body.error;
  } catch {
    // ignore
  }
  return `Request failed (${res.status})`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function throwApiError(res: Response): Promise<never> {
  throw new ApiError(await parseApiError(res), res.status);
}

// Must be location.assign, never fetch: fetch would follow the 302 as an XHR
// straight to the identity provider, a cross-origin call the backend-for-frontend
// design exists specifically to avoid.
export function signInRedirect(returnTo?: string): void {
  const target = returnTo ?? location.pathname + location.search;
  location.assign(`/api/auth/login?returnTo=${encodeURIComponent(target)}`);
}
