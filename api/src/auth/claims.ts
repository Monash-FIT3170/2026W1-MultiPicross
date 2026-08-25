import { env } from "../env.js";

export class AuthClaimError extends Error {}

// The anchor must be an immutable, non-email identifier, so never fall back to email/sub/preferred_username.
export function extractAnchor(claims: Record<string, unknown>): string {
  const claimName = env("OIDC_ANCHOR_CLAIM");
  const value = claims[claimName];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AuthClaimError(`Missing or invalid anchor claim "${claimName}"`);
  }
  return value;
}

const RETURN_TO_PATHS = new Set([
  "/",
  "/singleplayer",
  "/multiplayer/unrated",
  "/multiplayer/ranked",
  "/statistics",
  "/tutorial",
  "/settings",
  "/welcome",
]);

// `/room/:roomId` is dynamic, so it cannot live in the Set above. The pattern is
// anchored end-to-end and its character class admits no `/`, `.` or `%`, so it
// can never match an extra path segment (`/room/a/b`), a dot-segment
// (`/room/..//evil.com` normalises to `//evil.com` and fails the anchor), or an
// encoded separator (`/room/a%2fb`). That keeps the allowlist property below:
// the pathname is matched exactly, never parsed and reassembled.
const ROOM_PATH = /^\/room\/[A-Za-z0-9_-]+$/;

// Allowlisted rather than parsed: URL normalisation can leave a same-origin
// pathname that a browser rereads as protocol-relative (`/..//evil.com`).
export function safeReturnTo(
  raw: string | undefined | null,
  appBaseUrl: string,
): string {
  try {
    const target = new URL(raw ?? "/", appBaseUrl);
    if (target.origin !== new URL(appBaseUrl).origin) return "/";
    if (
      !RETURN_TO_PATHS.has(target.pathname) &&
      !ROOM_PATH.test(target.pathname)
    )
      return "/";
    return `${target.pathname}${target.search}`;
  } catch {
    return "/";
  }
}
