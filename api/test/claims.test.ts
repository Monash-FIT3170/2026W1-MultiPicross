process.env.OIDC_ANCHOR_CLAIM = "federatedObjectID";

import { test } from "node:test";
import assert from "node:assert/strict";
import { AuthClaimError, extractAnchor } from "../src/auth/claims.js";

test("extracts the anchor from a typical OIDC payload", () => {
  const claims = {
    federatedObjectID: "AbCdEf123==",
    email: "student@example.edu",
    name: "Student Name",
  };
  assert.equal(extractAnchor(claims), "AbCdEf123==");
});

test("throws when the anchor claim is missing", () => {
  assert.throws(() => extractAnchor({ email: "a@b.com" }), AuthClaimError);
});

test("throws when the anchor claim is an empty or whitespace-only string", () => {
  assert.throws(() => extractAnchor({ federatedObjectID: "" }), AuthClaimError);
  assert.throws(
    () => extractAnchor({ federatedObjectID: "   " }),
    AuthClaimError,
  );
});

test("throws when the anchor claim is not a string", () => {
  assert.throws(
    () => extractAnchor({ federatedObjectID: 123 }),
    AuthClaimError,
  );
  assert.throws(
    () => extractAnchor({ federatedObjectID: { sub: "x" } }),
    AuthClaimError,
  );
  assert.throws(
    () => extractAnchor({ federatedObjectID: null }),
    AuthClaimError,
  );
});

test("never falls back to email, name, or sub when the configured anchor claim is absent (req 2.5)", () => {
  const claims = {
    email: "student@example.edu",
    name: "Student Name",
    sub: "some-sub-value",
  };
  assert.throws(() => extractAnchor(claims), AuthClaimError);
});
