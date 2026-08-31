import assert from "assert";
import { createHmac } from "node:crypto";
import { verifyRoomToken } from "../src/auth/roomToken.js";

const SECRET = "test-secret";

function base64Url(input: object | Buffer): string {
  const buf = Buffer.isBuffer(input)
    ? input
    : Buffer.from(JSON.stringify(input));
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeToken(
  payload: Record<string, unknown>,
  secret: string = SECRET,
  alg = "HS256",
): string {
  const header = base64Url({ alg, typ: "JWT" });
  const body = base64Url(payload);
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest();
  return `${header}.${body}.${base64Url(signature)}`;
}

const future = Math.floor(Date.now() / 1000) + 60;
const past = Math.floor(Date.now() / 1000) - 60;

describe("verifyRoomToken", () => {
  it("accepts a validly signed, unexpired room token", () => {
    const token = makeToken({
      sub: "acct-1",
      username: "nam",
      type: "room",
      exp: future,
    });
    assert.deepStrictEqual(verifyRoomToken(token, SECRET), {
      sub: "acct-1",
      username: "nam",
      type: "room",
      exp: future,
    });
  });

  it("rejects a token signed with a different secret", () => {
    const token = makeToken(
      { sub: "acct-1", username: "nam", type: "room", exp: future },
      "wrong-secret",
    );
    assert.strictEqual(verifyRoomToken(token, SECRET), null);
  });

  it("rejects an expired token", () => {
    const token = makeToken({
      sub: "acct-1",
      username: "nam",
      type: "room",
      exp: past,
    });
    assert.strictEqual(verifyRoomToken(token, SECRET), null);
  });

  it("rejects a token that isn't of type 'room'", () => {
    const token = makeToken({
      sub: "acct-1",
      username: "nam",
      type: "access",
      exp: future,
    });
    assert.strictEqual(verifyRoomToken(token, SECRET), null);
  });

  it("rejects a token signed with a non-HS256 alg header", () => {
    const token = makeToken(
      { sub: "acct-1", username: "nam", type: "room", exp: future },
      SECRET,
      "none",
    );
    assert.strictEqual(verifyRoomToken(token, SECRET), null);
  });

  it("rejects malformed input", () => {
    assert.strictEqual(verifyRoomToken("not-a-jwt", SECRET), null);
    assert.strictEqual(verifyRoomToken("", SECRET), null);
  });
});
