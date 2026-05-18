import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { sValidator } from "@hono/standard-validator";
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

const TokenBody = v.object({
  refreshToken: v.string(),
});

// toJsonSchema returns a superset type; cast to satisfy hono-openapi's OpenAPIV3.SchemaObject
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

async function issueTokenPair(
  accountId: string,
  username: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const jti = crypto.randomUUID();
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
  return { accessToken, refreshToken };
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
                accessToken: { type: "string" },
                refreshToken: { type: "string" },
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

    const tokens = await issueTokenPair(account.id, account.username);
    return c.json({ ...tokens, username: account.username });
  },
);

auth.post(
  "/refresh",
  describeRoute({
    tags: ["Auth"],
    summary: "Rotate refresh token and issue a new access token",
    requestBody: {
      required: true,
      content: { "application/json": { schema: schema(TokenBody) } },
    },
    responses: {
      200: {
        description: "New token pair",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                accessToken: { type: "string" },
                refreshToken: { type: "string" },
              },
            },
          },
        },
      },
      400: { description: "Validation error", content: validationErrorContent },
      401: {
        description: "Invalid or expired refresh token",
        content: errorContent,
      },
    },
  }),
  sValidator("json", TokenBody, (result, c) => {
    if (!result.success)
      return c.json({ error: result.error.map((i) => i.message) }, 400);
  }),
  async (c) => {
    const { refreshToken } = c.req.valid("json") as v.InferOutput<
      typeof TokenBody
    >;

    let payload: { sub: string; jti: string; type: string };
    try {
      payload = await verifyRefreshToken(refreshToken);
    } catch {
      return c.json({ error: "Invalid or expired refresh token" }, 401);
    }
    if (payload.type !== "refresh")
      return c.json({ error: "Invalid token type" }, 401);

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
    if (!deleted || !account)
      return c.json({ error: "Invalid or expired refresh token" }, 401);

    return c.json(await issueTokenPair(account.id, account.username));
  },
);

auth.post(
  "/logout",
  describeRoute({
    tags: ["Auth"],
    summary: "Invalidate a refresh token",
    requestBody: {
      required: true,
      content: { "application/json": { schema: schema(TokenBody) } },
    },
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
    },
  }),
  sValidator("json", TokenBody, (result, c) => {
    if (!result.success)
      return c.json({ error: result.error.map((i) => i.message) }, 400);
  }),
  async (c) => {
    const { refreshToken } = c.req.valid("json") as v.InferOutput<
      typeof TokenBody
    >;
    try {
      const payload = await verifyRefreshToken(refreshToken);
      await db.delete(refreshTokens).where(eq(refreshTokens.id, payload.jti));
    } catch {
      // silently ignore invalid tokens on logout
    }
    return c.json({ success: true });
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
