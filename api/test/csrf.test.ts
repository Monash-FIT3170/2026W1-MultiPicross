import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { csrf } from "../src/auth/csrf.js";
import { CSRF_COOKIE } from "../src/auth/cookies.js";

function buildApp() {
  const app = new Hono();
  app.get("/thing", csrf, (c) => c.json({ ok: true }));
  app.post("/thing", csrf, (c) => c.json({ ok: true }));
  return app;
}

test("GET passes with no CSRF header", async () => {
  const app = buildApp();
  const res = await app.request("/thing");
  assert.equal(res.status, 200);
});

test("POST with no CSRF header is rejected", async () => {
  const app = buildApp();
  const res = await app.request("/thing", { method: "POST" });
  assert.equal(res.status, 403);
});

test("POST with a header that doesn't match the cookie is rejected", async () => {
  const app = buildApp();
  const res = await app.request("/thing", {
    method: "POST",
    headers: {
      "X-CSRF-Token": "header-value",
      Cookie: `${CSRF_COOKIE}=cookie-value`,
    },
  });
  assert.equal(res.status, 403);
});

test("POST with a matching header and cookie passes", async () => {
  const app = buildApp();
  const res = await app.request("/thing", {
    method: "POST",
    headers: {
      "X-CSRF-Token": "matching-value",
      Cookie: `${CSRF_COOKIE}=matching-value`,
    },
  });
  assert.equal(res.status, 200);
});
