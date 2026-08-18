process.env.OIDC_STATE_SECRET = "test-oidc-state-secret";

import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { setOidcTx, takeOidcTx, type OidcTx } from "../src/auth/oidc-state.js";

function buildApp() {
  const app = new Hono();
  app.get("/set/:state", async (c) => {
    await setOidcTx(c, c.req.param("state"), {
      v: "verifier",
      n: "nonce",
      r: "/return",
    });
    return c.body(null, 204);
  });
  app.get("/take/:state", async (c) => {
    const tx = await takeOidcTx(c, c.req.param("state"));
    return c.json({ tx });
  });
  return app;
}

function cookieHeader(res: Response): string {
  const raw = res.headers.get("set-cookie");
  assert.ok(raw, "expected a Set-Cookie header");
  return raw.split(";")[0];
}

test("round-trips verifier, nonce and returnTo through the signed cookie", async () => {
  const app = buildApp();
  const setRes = await app.request("/set/state-a");
  const cookie = cookieHeader(setRes);

  const takeRes = await app.request("/take/state-a", {
    headers: { Cookie: cookie },
  });
  const body = (await takeRes.json()) as { tx: OidcTx | null };
  assert.deepEqual(body.tx, { v: "verifier", n: "nonce", r: "/return" });
});

test("a tampered signature is rejected", async () => {
  const app = buildApp();
  const setRes = await app.request("/set/state-b");
  const cookie = cookieHeader(setRes);
  const [name, value] = cookie.split("=");
  // Flip the first signature character: the last one carries padding bits, so
  // flipping it decodes to identical bytes roughly one time in sixteen.
  const [header, payload, sig] = value.split(".");
  const tampered = `${name}=${header}.${payload}.${sig[0] === "A" ? "B" : "A"}${sig.slice(1)}`;

  const takeRes = await app.request("/take/state-b", {
    headers: { Cookie: tampered },
  });
  const body = (await takeRes.json()) as { tx: OidcTx | null };
  assert.equal(body.tx, null);
});

test("an expired transaction token is rejected", async () => {
  const expired = await sign(
    {
      v: "verifier",
      n: "nonce",
      r: "/return",
      type: "oidc_tx",
      exp: Math.floor(Date.now() / 1000) - 10,
    },
    process.env.OIDC_STATE_SECRET!,
  );
  const app = buildApp();
  const takeRes = await app.request("/take/state-c", {
    headers: { Cookie: `oidc_tx_state-c=${expired}` },
  });
  const body = (await takeRes.json()) as { tx: OidcTx | null };
  assert.equal(body.tx, null);
});

test("a token with the wrong type claim is rejected", async () => {
  const wrongType = await sign(
    {
      v: "verifier",
      n: "nonce",
      r: "/return",
      type: "access",
      exp: Math.floor(Date.now() / 1000) + 600,
    },
    process.env.OIDC_STATE_SECRET!,
  );
  const app = buildApp();
  const takeRes = await app.request("/take/state-d", {
    headers: { Cookie: `oidc_tx_state-d=${wrongType}` },
  });
  const body = (await takeRes.json()) as { tx: OidcTx | null };
  assert.equal(body.tx, null);
});

test("a mismatched state (wrong cookie name) is a miss", async () => {
  const app = buildApp();
  const setRes = await app.request("/set/state-e");
  const cookie = cookieHeader(setRes);

  const takeRes = await app.request("/take/state-does-not-match", {
    headers: { Cookie: cookie },
  });
  const body = (await takeRes.json()) as { tx: OidcTx | null };
  assert.equal(body.tx, null);
});
