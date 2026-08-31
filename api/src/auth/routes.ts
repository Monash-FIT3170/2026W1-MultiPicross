import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { sValidator } from "@hono/standard-validator";
import { getCookie } from "hono/cookie";
import { requireAuth } from "./middleware.js";
import { and, eq, desc, gte, lt, count } from "drizzle-orm";
import * as v from "valibot";
import { toJsonSchema } from "@valibot/to-json-schema";
import type { OpenAPIV3 } from "openapi-types";
import {
  randomPKCECodeVerifier,
  calculatePKCECodeChallenge,
  randomState,
  randomNonce,
  buildAuthorizationUrl,
  authorizationCodeGrant,
} from "openid-client";
import { db } from "../db/client.js";
import {
  accounts,
  identities,
  loginAttempts,
  refreshTokens,
  playerEloHistory,
} from "../db/schema.js";
import { isUniqueViolation } from "../db/errors.js";
import { env } from "../env.js";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  signRoomToken,
  verifyRefreshToken,
  hashToken,
  refreshExpiresAt,
} from "./helpers.js";
import {
  REFRESH_COOKIE,
  setAuthCookies,
  clearAuthCookies,
  newCsrfToken,
} from "./cookies.js";
import { csrf } from "./csrf.js";
import {
  getOidcConfig,
  oidcRedirectUri,
  oidcScopes,
  oidcProviderId,
} from "./oidc.js";
import { extractAnchor, AuthClaimError, safeReturnTo } from "./claims.js";
import { setOidcTx, takeOidcTx } from "./oidc-state.js";

const LoginBody = v.object({
  username: v.pipe(v.string(), v.maxLength(64)),
  password: v.pipe(v.string(), v.maxLength(256)),
});

const HandleBody = v.object({
  handle: v.pipe(
    v.string(),
    v.minLength(3, "Handle must be at least 3 characters"),
    v.maxLength(20, "Handle must be at most 20 characters"),
    v.regex(
      /^[a-zA-Z0-9_-]+$/,
      "Handle may only contain letters, numbers, underscores and hyphens",
    ),
  ),
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

const meSchema: OpenAPIV3.SchemaObject = {
  type: "object",
  properties: {
    id: { type: "string" },
    handle: { type: "string", nullable: true },
    kind: { type: "string", enum: ["sso", "service"] },
  },
};
const meContent = { "application/json": { schema: meSchema } };

async function issueSession(
  c: Parameters<typeof setAuthCookies>[0],
  accountId: string,
): Promise<void> {
  const jti = crypto.randomUUID();
  const csrfToken = newCsrfToken();
  const [refreshToken, accessToken] = await Promise.all([
    signRefreshToken({ sub: accountId, jti }),
    signAccessToken({ sub: accountId }),
  ]);
  await db.insert(refreshTokens).values({
    id: jti,
    accountId,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiresAt(),
  });
  if (Math.random() < PRUNE_SAMPLE_RATE) {
    pruneRefreshTokens().catch((err: unknown) =>
      console.warn("refresh_tokens prune failed:", err),
    );
  }
  setAuthCookies(c, { accessToken, refreshToken, csrfToken });
}

// Upserts the (accounts, identities) pair for a successful SSO login. Exported
// so tests can exercise it directly instead of driving a full HTTP login.
export async function upsertSsoIdentity(params: {
  provider: string;
  subject: string;
  issuer: string;
}): Promise<string> {
  const { provider, subject, issuer } = params;

  const existing = await db.query.identities.findFirst({
    where: and(
      eq(identities.provider, provider),
      eq(identities.subject, subject),
    ),
  });
  if (existing) {
    await db
      .update(identities)
      .set({ lastLoginAt: new Date() })
      .where(eq(identities.id, existing.id));
    return existing.accountId;
  }

  try {
    return await db.transaction(async (tx) => {
      const [account] = await tx
        .insert(accounts)
        .values({ kind: "sso" })
        .returning({ id: accounts.id });
      await tx.insert(identities).values({
        accountId: account.id,
        provider,
        subject,
        issuer,
        lastLoginAt: new Date(),
      });
      return account.id;
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Two callbacks raced (double-clicked sign-in); re-run the read path once.
    const raced = await db.query.identities.findFirst({
      where: and(
        eq(identities.provider, provider),
        eq(identities.subject, subject),
      ),
    });
    if (!raced) throw err;
    await db
      .update(identities)
      .set({ lastLoginAt: new Date() })
      .where(eq(identities.id, raced.id));
    return raced.accountId;
  }
}

const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const PRUNE_SAMPLE_RATE = 0.02;

async function isLoginLocked(username: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_LOCKOUT_WINDOW_MS);
  const [row] = await db
    .select({ count: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.username, username),
        gte(loginAttempts.attemptedAt, since),
      ),
    );
  return (row?.count ?? 0) >= LOGIN_LOCKOUT_THRESHOLD;
}

async function recordLoginFailure(username: string): Promise<void> {
  await db.insert(loginAttempts).values({ username });
}

async function clearLoginFailures(username: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.username, username));
}

// Prune opportunistically so a sustained attack can't grow the table unbounded.
export async function pruneLoginAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, cutoff));
}

// Sessions that are abandoned rather than logged out leave their row behind, so
// nothing else ever reclaims these.
export async function pruneRefreshTokens(): Promise<void> {
  await db.delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date()));
}

let dummyHashPromise: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise)
    dummyHashPromise = hashPassword("not-a-real-password-used-only-for-timing");
  return dummyHashPromise;
}

const auth = new Hono();

auth.get(
  "/login",
  describeRoute({
    tags: ["Auth"],
    summary: "Start SSO login (redirects to the identity provider)",
    parameters: [
      {
        in: "query",
        name: "returnTo",
        required: false,
        schema: { type: "string" },
      },
    ],
    responses: {
      302: { description: "Redirect to the identity provider" },
    },
  }),
  // GET requests are exempt from the csrf middleware, so this route doesn't need it.
  async (c) => {
    c.header("Cache-Control", "no-store");
    const appBaseUrl = env("APP_BASE_URL");
    const returnTo = safeReturnTo(c.req.query("returnTo"), appBaseUrl);

    const config = await getOidcConfig();
    const codeVerifier = randomPKCECodeVerifier();
    const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);
    const state = randomState();
    const nonce = randomNonce();

    const authUrl = buildAuthorizationUrl(config, {
      redirect_uri: oidcRedirectUri(),
      scope: oidcScopes(),
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      nonce,
    });

    await setOidcTx(c, state, { v: codeVerifier, n: nonce, r: returnTo });
    return c.redirect(authUrl.toString(), 302);
  },
);

auth.get(
  "/callback",
  describeRoute({
    tags: ["Auth"],
    summary: "SSO callback: exchange the code and establish a session",
    responses: {
      302: { description: "Redirect to the app, or to an error page" },
    },
  }),
  async (c) => {
    c.header("Cache-Control", "no-store");

    const errorParam = c.req.query("error");
    if (errorParam) {
      // The error code is a fixed OAuth enum; error_description is provider-controlled
      // free text and must never be reflected into the redirect.
      return c.redirect(
        `/auth/error?code=${encodeURIComponent(errorParam)}`,
        302,
      );
    }

    const state = c.req.query("state");
    const tx = state ? await takeOidcTx(c, state) : null;
    if (!tx) {
      return c.redirect("/auth/error?code=invalid_state", 302);
    }

    // Build the token-exchange URL deterministically. Behind Traefik, c.req.url
    // carries the internal scheme/host and a header-derived (attacker-influenced) Host.
    const currentUrl = new URL(oidcRedirectUri());
    currentUrl.search = new URL(c.req.url).search;

    const config = await getOidcConfig();
    let tokens;
    try {
      tokens = await authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: tx.v,
        expectedState: state,
        expectedNonce: tx.n,
        idTokenExpected: true,
      });
    } catch (err) {
      console.warn("OIDC token exchange failed:", err);
      return c.redirect("/auth/error?code=token_exchange_failed", 302);
    }

    const claims = tokens.claims();
    if (!claims) {
      console.warn("OIDC response carried no id_token claims");
      return c.redirect("/auth/error?code=missing_anchor", 302);
    }

    let anchor: string;
    try {
      anchor = extractAnchor(claims);
    } catch (err) {
      if (err instanceof AuthClaimError) {
        // Names only. Claim values identify a real person and must not reach the logs.
        console.warn(
          `${err.message}. Claims present: ${Object.keys(claims).join(", ")}`,
        );
        return c.redirect("/auth/error?code=missing_anchor", 302);
      }
      throw err;
    }

    // No group or allowlist check here: the provider refuses to issue a token
    // to anyone outside the permitted audience, so an unauthorised user never
    // reaches this handler. Every provider token is discarded below; none is persisted.
    const accountId = await upsertSsoIdentity({
      provider: oidcProviderId(),
      subject: anchor,
      issuer: String(claims.iss),
    });

    await issueSession(c, accountId);
    return c.redirect(tx.r, 302);
  },
);

auth.post(
  "/handle",
  requireAuth,
  csrf,
  describeRoute({
    tags: ["Auth"],
    summary: "Set or change the account handle",
    requestBody: {
      required: true,
      content: { "application/json": { schema: schema(HandleBody) } },
    },
    responses: {
      200: {
        description: "Handle set",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { handle: { type: "string" } },
            },
          },
        },
      },
      400: { description: "Validation error", content: validationErrorContent },
      401: { description: "Not authenticated", content: errorContent },
      403: { description: "Invalid CSRF token", content: errorContent },
      404: { description: "Account not found", content: errorContent },
      409: { description: "Handle already taken", content: errorContent },
    },
  }),
  sValidator("json", HandleBody, (result, c) => {
    if (!result.success)
      return c.json({ error: result.error.map((i) => i.message) }, 400);
  }),
  async (c) => {
    const { sub: accountId } = c.get("jwtPayload") as { sub: string };
    const { handle } = c.req.valid("json" as never) as v.InferOutput<
      typeof HandleBody
    >;

    try {
      const [updated] = await db
        .update(accounts)
        .set({ handle })
        .where(eq(accounts.id, accountId))
        .returning({ handle: accounts.handle });
      if (!updated) return c.json({ error: "Account not found" }, 404);
      return c.json({ handle: updated.handle });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json({ error: "That handle is taken" }, 409);
      }
      throw err;
    }
  },
);

auth.post(
  "/login",
  describeRoute({
    tags: ["Auth"],
    summary: "Login with username and password (service accounts only)",
    requestBody: {
      required: true,
      content: { "application/json": { schema: schema(LoginBody) } },
    },
    responses: {
      200: { description: "Login successful", content: meContent },
      400: { description: "Validation error", content: validationErrorContent },
      401: { description: "Invalid credentials", content: errorContent },
      429: { description: "Too many attempts", content: errorContent },
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

    if (Math.random() < PRUNE_SAMPLE_RATE) {
      pruneLoginAttempts().catch((err: unknown) =>
        console.warn("login_attempts prune failed:", err),
      );
    }

    if (await isLoginLocked(username)) {
      return c.json({ error: "Too many attempts, try again later" }, 429);
    }

    const invalid = () => c.json({ error: "Invalid credentials" }, 401);

    const account = await db.query.accounts.findFirst({
      where: eq(accounts.username, username),
    });

    // A missing account, wrong account kind, and an unset password hash all
    // burn a dummy verify so none is timing-distinguishable from a wrong password.
    if (
      !account ||
      account.kind !== "service" ||
      account.passwordHash === null
    ) {
      await verifyPassword(password, await getDummyHash());
      await recordLoginFailure(username);
      return invalid();
    }

    const valid = await verifyPassword(password, account.passwordHash);
    if (!valid) {
      await recordLoginFailure(username);
      return invalid();
    }

    await clearLoginFailures(username);
    await issueSession(c, account.id);
    return c.json({
      id: account.id,
      handle: account.handle,
      kind: account.kind,
    });
  },
);

auth.post(
  "/refresh",
  csrf,
  describeRoute({
    tags: ["Auth"],
    summary: "Rotate refresh token and issue a new access token",
    responses: {
      200: { description: "Session refreshed", content: meContent },
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

    await issueSession(c, account.id);
    return c.json({
      id: account.id,
      handle: account.handle,
      kind: account.kind,
    });
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
    // Sign-out is local only. Do NOT call the provider's end_session_endpoint.
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
  requireAuth,
  describeRoute({
    tags: ["Auth"],
    summary: "Get the currently authenticated user",
    responses: {
      200: { description: "Authenticated user", content: meContent },
      401: { description: "Not authenticated", content: errorContent },
      404: { description: "Account not found", content: errorContent },
    },
  }),
  async (c) => {
    const { sub: accountId } = c.get("jwtPayload") as { sub: string };
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      columns: { id: true, handle: true, kind: true },
    });
    if (!account) return c.json({ error: "Account not found" }, 404);
    return c.json({
      id: account.id,
      handle: account.handle,
      kind: account.kind,
    });
  },
);

auth.post(
  "/room-token",
  requireAuth,
  csrf,
  describeRoute({
    tags: ["Auth"],
    summary: "Mint a short-lived token for joining a multiplayer room",
    description:
      "Proves the caller's identity to the gameserver without exposing the session cookie to it.",
    responses: {
      200: {
        description: "Room token issued",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { token: { type: "string" } },
            },
          },
        },
      },
      400: { description: "Account has no handle", content: errorContent },
      401: { description: "Not authenticated", content: errorContent },
      403: { description: "Invalid CSRF token", content: errorContent },
      404: { description: "Account not found", content: errorContent },
    },
  }),
  async (c) => {
    const { sub: accountId } = c.get("jwtPayload") as { sub: string };

    // The access token carries only `sub` (see signAccessToken), so the
    // display name has to be loaded here. It lives in accounts.handle,
    // which is nullable until the user picks one.
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
      columns: { id: true, handle: true },
    });
    if (!account) return c.json({ error: "Account not found" }, 404);
    if (!account.handle) {
      return c.json({ error: "Set a handle before joining a room" }, 400);
    }

    // Claim name mapping: the token's `username` claim carries the account
    // handle. The gameserver reads it as the player's display name.
    const token = await signRoomToken({
      sub: account.id,
      username: account.handle,
    });
    return c.json({ token });
  },
);

export default auth;
