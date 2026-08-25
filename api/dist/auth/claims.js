import { env } from "../env.js";
export class AuthClaimError extends Error {
}
// The anchor must be an immutable, non-email identifier, so never fall back to email/sub/preferred_username.
export function extractAnchor(claims) {
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
    "/multiplayer/public",
    "/multiplayer/private",
    "/multiplayer/ranked",
    "/statistics",
    "/tutorial",
    "/settings",
    "/welcome",
]);
// Allowlisted rather than parsed: URL normalisation can leave a same-origin
// pathname that a browser rereads as protocol-relative (`/..//evil.com`).
export function safeReturnTo(raw, appBaseUrl) {
    try {
        const target = new URL(raw ?? "/", appBaseUrl);
        if (target.origin !== new URL(appBaseUrl).origin)
            return "/";
        if (!RETURN_TO_PATHS.has(target.pathname))
            return "/";
        return `${target.pathname}${target.search}`;
    }
    catch {
        return "/";
    }
}
