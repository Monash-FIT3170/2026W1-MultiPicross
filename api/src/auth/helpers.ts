import { hash, verify as argon2Verify } from "@node-rs/argon2";
import { sign, verify as jwtVerify } from "hono/jwt";
import { createHash } from "node:crypto";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`${name} must be set`);
  return val;
}

const ACCESS_SECRET = requireEnv('JWT_ACCESS_SECRET');
const REFRESH_SECRET = requireEnv('JWT_REFRESH_SECRET');

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(
  plain: string,
  storedHash: string,
): Promise<boolean> {
  return argon2Verify(storedHash, plain);
}

export async function signAccessToken(payload: {
  sub: string;
  username: string;
}): Promise<string> {
  return sign(
    {
      ...payload,
      type: "access",
      exp: Math.floor(Date.now() / 1000) + ACCESS_TTL_SECONDS,
    },
    ACCESS_SECRET,
  );
}

export async function signRefreshToken(payload: {
  sub: string;
  jti: string;
}): Promise<string> {
  return sign(
    {
      ...payload,
      type: "refresh",
      exp: Math.floor(Date.now() / 1000) + REFRESH_TTL_SECONDS,
    },
    REFRESH_SECRET,
  );
}

export async function verifyRefreshToken(
  token: string,
): Promise<{ sub: string; jti: string; type: string }> {
  const payload = await jwtVerify(token, REFRESH_SECRET, "HS256");
  return payload as { sub: string; jti: string; type: string };
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function refreshExpiresAt(): Date {
  return new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
}
