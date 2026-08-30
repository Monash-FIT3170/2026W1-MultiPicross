import { test } from "node:test";
import assert from "node:assert/strict";
import { safeReturnTo } from "../src/auth/claims.js";

const APP_BASE_URL = "http://multipicross.localhost";

test("allowlisted root path is returned as-is", () => {
  assert.equal(safeReturnTo("/", APP_BASE_URL), "/");
});

test("allowlisted path with query string is preserved", () => {
  assert.equal(
    safeReturnTo("/singleplayer?size=10", APP_BASE_URL),
    "/singleplayer?size=10",
  );
});

test("same-origin path outside the allowlist falls back to root", () => {
  assert.equal(safeReturnTo("/not-a-route", APP_BASE_URL), "/");
});

test("protocol-relative URL is rejected, not resolved to a foreign origin", () => {
  assert.equal(safeReturnTo("//evil.com", APP_BASE_URL), "/");
});

test("backslash-prefixed URL is rejected, not resolved to a foreign origin", () => {
  assert.equal(safeReturnTo("/\\evil.com", APP_BASE_URL), "/");
});

test("absolute URL to a foreign origin is rejected", () => {
  assert.equal(safeReturnTo("https://evil.com", APP_BASE_URL), "/");
});

test("javascript: URL is rejected", () => {
  assert.equal(safeReturnTo("javascript:alert(1)", APP_BASE_URL), "/");
});

test("dot-segment traversal cannot produce a protocol-relative path", () => {
  assert.equal(safeReturnTo("/..//evil.com", APP_BASE_URL), "/");
  assert.equal(safeReturnTo("/./\\/evil.com", APP_BASE_URL), "/");
});

test("same-origin absolute URL cannot smuggle a protocol-relative path", () => {
  assert.equal(safeReturnTo(`${APP_BASE_URL}//evil.com`, APP_BASE_URL), "/");
  assert.equal(safeReturnTo(`${APP_BASE_URL}/\\evil.com`, APP_BASE_URL), "/");
  assert.equal(
    safeReturnTo("//multipicross.localhost//evil.com", APP_BASE_URL),
    "/",
  );
});

test("every allowlisted path resolves to itself", () => {
  for (const path of [
    "/",
    "/singleplayer",
    "/multiplayer/unrated",
    "/multiplayer/ranked",
    "/statistics",
    "/tutorial",
    "/settings",
    "/welcome",
  ]) {
    assert.equal(safeReturnTo(path, APP_BASE_URL), path);
  }
});

test("dynamic room path is allowed", () => {
  assert.equal(safeReturnTo("/room/ABC123", APP_BASE_URL), "/room/ABC123");
  assert.equal(safeReturnTo("/room/a_b-c", APP_BASE_URL), "/room/a_b-c");
});

test("room path keeps its query string", () => {
  assert.equal(
    safeReturnTo("/room/ABC123?spectate=1", APP_BASE_URL),
    "/room/ABC123?spectate=1",
  );
});

test("room path cannot smuggle a protocol-relative path", () => {
  assert.equal(safeReturnTo("/room/..//evil.com", APP_BASE_URL), "/");
  assert.equal(safeReturnTo("/room/../..//evil.com", APP_BASE_URL), "/");
  assert.equal(safeReturnTo("/room/a/\\evil.com", APP_BASE_URL), "/");
});

test("room path is a single segment only", () => {
  assert.equal(safeReturnTo("/room/a/b", APP_BASE_URL), "/");
  assert.equal(safeReturnTo("/room/", APP_BASE_URL), "/");
  assert.equal(safeReturnTo("/room", APP_BASE_URL), "/");
  assert.equal(safeReturnTo("/room/a%2fb", APP_BASE_URL), "/");
  assert.equal(safeReturnTo("/roomy/abc", APP_BASE_URL), "/");
});

test("empty string defaults to root", () => {
  assert.equal(safeReturnTo("", APP_BASE_URL), "/");
});

test("undefined defaults to root", () => {
  assert.equal(safeReturnTo(undefined, APP_BASE_URL), "/");
});

test("null defaults to root", () => {
  assert.equal(safeReturnTo(null, APP_BASE_URL), "/");
});
