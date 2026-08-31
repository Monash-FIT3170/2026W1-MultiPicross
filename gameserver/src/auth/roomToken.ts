import { createHmac, timingSafeEqual } from "node:crypto";

// Verifies HS256 JWTs minted by api's signRoomToken (hono/jwt). Kept
// dependency-free since this is the only JWT operation gameserver needs.

export interface RoomTokenPayload {
  sub: string;
  username: string;
  type: string;
  exp: number;
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function verifyRoomToken(
  token: string,
  secret: string,
): RoomTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string };
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf8"));
  } catch {
    return null;
  }
  if (header.alg !== "HS256") return null;

  const expectedSig = createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const actualSig = base64UrlDecode(signatureB64);
  if (
    expectedSig.length !== actualSig.length ||
    !timingSafeEqual(expectedSig, actualSig)
  ) {
    return null;
  }

  let payload: RoomTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));
  } catch {
    return null;
  }

  if (payload.type !== "room") return null;
  if (typeof payload.sub !== "string" || typeof payload.username !== "string")
    return null;
  if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000)
    return null;

  return payload;
}
