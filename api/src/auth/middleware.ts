import type { MiddlewareHandler } from "hono";
import { jwt } from "hono/jwt";
import { ACCESS_COOKIE } from "./cookies.js";
import { env } from "../env.js";

let jwtMiddleware: MiddlewareHandler | undefined;

export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (!jwtMiddleware) {
    jwtMiddleware = jwt({
      secret: env("JWT_ACCESS_SECRET"),
      cookie: ACCESS_COOKIE,
      alg: "HS256",
    });
  }
  await jwtMiddleware(c, async () => {
    const payload = c.get("jwtPayload") as { type?: string };
    if (payload.type !== "access") {
      // hono's jwt() discards next()'s return value, so finalize the response here rather than returning it.
      c.res = c.json({ error: "Invalid token type" }, 401);
      return;
    }
    await next();
  });
};
