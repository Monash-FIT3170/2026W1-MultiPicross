import { jwt } from "hono/jwt";
import { ACCESS_COOKIE } from "./cookies.js";

export const requireAuth = jwt({
  secret: process.env.JWT_ACCESS_SECRET!,
  cookie: ACCESS_COOKIE,
  alg: "HS256",
});
