import { setCookie, deleteCookie } from "hono/cookie";
export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
export const CSRF_COOKIE = "csrf_token";
const secure = process.env.NODE_ENV === "production";
export function setAuthCookies(c, tokens) {
    setCookie(c, ACCESS_COOKIE, tokens.accessToken, {
        httpOnly: true,
        sameSite: "Lax",
        secure,
        path: "/api",
        maxAge: 900,
    });
    setCookie(c, REFRESH_COOKIE, tokens.refreshToken, {
        httpOnly: true,
        sameSite: "Lax",
        secure,
        path: "/api/auth",
        maxAge: 604800,
    });
    setCookie(c, CSRF_COOKIE, tokens.csrfToken, {
        httpOnly: false,
        sameSite: "Lax",
        secure,
        path: "/",
        maxAge: 604800,
    });
}
export function clearAuthCookies(c) {
    deleteCookie(c, ACCESS_COOKIE, { path: "/api" });
    deleteCookie(c, REFRESH_COOKIE, { path: "/api/auth" });
    deleteCookie(c, CSRF_COOKIE, { path: "/" });
}
export function newCsrfToken() {
    return crypto.randomUUID();
}
