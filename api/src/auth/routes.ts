import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { sValidator } from "@hono/standard-validator";
import { jwt } from "hono/jwt";
import { getCookie } from "hono/cookie";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { toJsonSchema } from "@valibot/to-json-schema";
import type { OpenAPIV3 } from "openapi-types";
import { db } from "../db/client.js";
import { accounts, refreshTokens } from "../db/schema.js";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  refreshExpiresAt,
} from "./helpers.js";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  setAuthCookies,
  clearAuthCookies,
  newCsrfToken,
} from "./cookies.js";
import { csrf } from "./csrf.js";

const RegisterBody = v.object({
  username: v.pipe(
    v.string(),
    v.minLength(3, "Username must be at least 3 characters"),
  ),
  password: v.pipe(
    v.string(),
    v.minLength(8, "Password must be at least 8 characters"),
  ),
});

const LoginBody = v.object({
  username: v.string(),
  password: v.string(),
});

function schema<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  s: T,
): OpenAPIV3.SchemaObject {
  return toJsonSchema(s) as unknown as OpenAPIV3.SchemaObject;
}

const validationErrorSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    error: { type: "array", items: { type: "string" } },
  },
};

const errorSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: { error: { type: "string" } },
};

const validationErrorContent = {
  "application/json": { schema: validationErrorSchema },
};
const errorContent = { "application/json": { schema: errorSchema } };

async function issueSession(
  c: Parameters<typeof setAuthCookies>[0],
  accountId: string,
  username: string,
): Promise<void> {
  const jti = crypto.randomUUID();
  const csrfToken = newCsrfToken();
  const [refreshToken, accessToken] = await Promise.all([
    signRefreshToken({ sub: accountId, jti }),
    signAccessToken({ sub: accountId, username }),
  ]);
  await db.insert(refreshTokens).values({
    id: jti,
    accountId,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiresAt(),
  });
  setAuthCookies(c, { accessToken, refreshToken, csrfToken });
}

const auth = new Hono();

auth.post(
  "/register",
  describeRoute({
    tags: ["Auth"],
    summary: "Register a new account",
    requestBody: {
      required: true,
      content: { "application/json": { schema: schema(RegisterBody) } },
    },
    responses: {
      201: { description: "Account created" },
      400: { description: "Validation error", content: validationErrorContent },
      409: { description: "Username already taken", content: errorContent },
    },
  }),
  sValidator("json", RegisterBody, (result, c) => {
    if (!result.success)
      return c.json({ error: result.error.map((i) => i.message) }, 400);
  }),
  async (c) => {
    const { username, password } = c.req.valid(
      "json" as never,
    ) as v.InferOutput<typeof RegisterBody>;
    const passwordHash = await hashPassword(password);
    try {
      await db.insert(accounts).values({ username, passwordHash });
      return c.body(null, 201);
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        return c.json({ error: "Username already taken" }, 409);
      }
      throw err;
    }
  },
);

auth.post(
  "/login",
  describeRoute({
    tags: ["Auth"],
    summary: "Login with username and password",
    requestBody: {
      required: true,
      content: { "application/json": { schema: schema(LoginBody) } },
    },
    responses: {
      200: {
        description: "Login successful",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                username: { type: "string" },
              },
            },
          },
        },
      },
      400: { description: "Validation error", content: validationErrorContent },
      401: { description: "Invalid credentials", content: errorContent },
    },
  }),
  sValidator("json", LoginBody, (result, c) => {
    if (!result.success)
      return c.json({ error: result.error.map((i) => i.message) }, 400);
  }),
  async (c) => {
    const { username, password } = c.req.valid(
      "json" as never,
    ) as v.InferOutput<typeof LoginBody>;
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.username, username),
    });

    const invalid = () => c.json({ error: "Invalid credentials" }, 401);
    if (!account) return invalid();

    const valid = await verifyPassword(password, account.passwordHash);
    if (!valid) return invalid();

    await issueSession(c, account.id, account.username);
    return c.json({ username: account.username });
  },
);

auth.post(
  "/refresh",
  csrf,
  describeRoute({
    tags: ["Auth"],
    summary: "Rotate refresh token and issue a new access token",
    responses: {
      200: {
        description: "Session refreshed",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { username: { type: "string" } },
            },
          },
        },
      },
      401: {
        description: "Invalid or expired refresh token",
        content: errorContent,
      },
      403: { description: "Invalid CSRF token", content: errorContent },
    },
  }),
  async (c) => {
    const refreshToken = getCookie(c, REFRESH_COOKIE);
    if (!refreshToken) {
      clearAuthCookies(c);
      return c.json({ error: "Invalid or expired refresh token" }, 401);
    }

    let payload: { sub: string; jti: string; type: string };
    try {
      payload = await verifyRefreshToken(refreshToken);
    } catch {
      clearAuthCookies(c);
      return c.json({ error: "Invalid or expired refresh token" }, 401);
    }
    if (payload.type !== "refresh") {
      clearAuthCookies(c);
      return c.json({ error: "Invalid token type" }, 401);
    }

    const tokenHash = hashToken(refreshToken);
    const [[deleted], account] = await Promise.all([
      db
        .delete(refreshTokens)
        .where(
          and(
            eq(refreshTokens.id, payload.jti),
            eq(refreshTokens.tokenHash, tokenHash),
          ),
        )
        .returning({ accountId: refreshTokens.accountId }),
      db.query.accounts.findFirst({ where: eq(accounts.id, payload.sub) }),
    ]);
    if (!deleted || !account) {
      clearAuthCookies(c);
      return c.json({ error: "Invalid or expired refresh token" }, 401);
    }

    await issueSession(c, account.id, account.username);
    return c.json({ username: account.username });
  },
);

auth.post(
  "/logout",
  csrf,
  describeRoute({
    tags: ["Auth"],
    summary: "Invalidate session and clear cookies",
    responses: {
      200: {
        description: "Logged out",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { success: { type: "boolean" } },
            },
          },
        },
      },
      403: { description: "Invalid CSRF token", content: errorContent },
    },
  }),
  async (c) => {
    const refreshToken = getCookie(c, REFRESH_COOKIE);
    if (refreshToken) {
      try {
        const payload = await verifyRefreshToken(refreshToken);
        await db.delete(refreshTokens).where(eq(refreshTokens.id, payload.jti));
      } catch {
        // silently ignore invalid tokens on logout
      }
    }
    clearAuthCookies(c);
    return c.json({ success: true });
  },
);

auth.get(
  "/me",
  jwt({ secret: process.env.JWT_ACCESS_SECRET!, cookie: ACCESS_COOKIE, alg: "HS256" }),
  describeRoute({
    tags: ["Auth"],
    summary: "Get the currently authenticated user",
    responses: {
      200: {
        description: "Authenticated user",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                id: { type: "string" },
                username: { type: "string" },
              },
            },
          },
        },
      },
      401: { description: "Not authenticated", content: errorContent },
    },
  }),
  (c) => {
    const payload = c.get("jwtPayload") as { sub: string; username: string };
    return c.json({ id: payload.sub, username: payload.username });
  },
);

const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const pg = (err as { cause?: unknown }).cause;
  if (pg instanceof Error && "code" in pg)
    return (pg as { code: string }).code === PG_UNIQUE_VIOLATION;
  return (
    "code" in err && (err as { code: string }).code === PG_UNIQUE_VIOLATION
  );
}

export default auth;
