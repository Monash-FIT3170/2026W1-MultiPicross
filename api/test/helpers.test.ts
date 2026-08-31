import { test } from "node:test";
import assert from "node:assert/strict";
import { decode, verify } from "hono/jwt";
import {
  signAccessToken,
  signRefreshToken,
  signRoomToken,
  verifyRefreshToken,
} from "../src/auth/helpers.js";

test("importing helpers.js does not throw without JWT secrets set", () => {
  assert.equal(typeof signAccessToken, "function");
});

test("access and refresh tokens round-trip with the correct type and exp claims", async () => {
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

  const accessToken = await signAccessToken({ sub: "user-1" });
  const accessPayload = decode(accessToken).payload as {
    type: string;
    exp: number;
  };
  assert.equal(accessPayload.type, "access");
  assert.equal(typeof accessPayload.exp, "number");

  const refreshToken = await signRefreshToken({ sub: "user-1", jti: "jti-1" });
  const refreshPayload = decode(refreshToken).payload as {
    type: string;
    exp: number;
  };
  assert.equal(refreshPayload.type, "refresh");
  assert.equal(typeof refreshPayload.exp, "number");

  const verified = await verifyRefreshToken(refreshToken);
  assert.equal(verified.type, "refresh");
});

// Guards the secret split: the gameserver is given JWT_ROOM_SECRET only, so a
// room token signed with JWT_ACCESS_SECRET would hand it the ability to mint
// API access tokens for any account.
test("room tokens are signed with JWT_ROOM_SECRET, not JWT_ACCESS_SECRET", async () => {
  process.env.JWT_ACCESS_SECRET = "test-access-secret";
  process.env.JWT_ROOM_SECRET = "test-room-secret";

  const roomToken = await signRoomToken({ sub: "user-1", username: "nam" });
  const roomPayload = decode(roomToken).payload as { type: string };
  assert.equal(roomPayload.type, "room");

  await assert.doesNotReject(() =>
    verify(roomToken, "test-room-secret", "HS256"),
  );
  await assert.rejects(() => verify(roomToken, "test-access-secret", "HS256"));
});
