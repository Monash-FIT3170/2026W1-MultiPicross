import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { CSRF_COOKIE } from "./cookies.js";

export const csrf: MiddlewareHandler = async (c, next) => {
  const method = c.req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }
  const headerToken = c.req.header("X-CSRF-Token");
  const cookieToken = getCookie(c, CSRF_COOKIE);
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return c.json({ error: "Invalid CSRF token" }, 403);
  }
  return next();
};
