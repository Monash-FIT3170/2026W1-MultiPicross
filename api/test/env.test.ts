import { test } from "node:test";
import assert from "node:assert/strict";
import { env, envBool, envList } from "../src/env.js";

test("env returns fallback when unset", () => {
  delete process.env.ENV_TEST_FALLBACK;
  assert.equal(env("ENV_TEST_FALLBACK", "default"), "default");
});

test("env returns the process.env value when set", () => {
  process.env.ENV_TEST_SET = "value";
  assert.equal(env("ENV_TEST_SET"), "value");
});

test("env throws with the exact message when unset and no fallback", () => {
  delete process.env.ENV_TEST_MISSING;
  assert.throws(() => env("ENV_TEST_MISSING"), {
    message: "ENV_TEST_MISSING must be set",
  });
});

test("envBool parses true/1 case-insensitively and falls back otherwise", () => {
  process.env.ENV_TEST_BOOL_TRUE = "TRUE";
  assert.equal(envBool("ENV_TEST_BOOL_TRUE"), true);

  process.env.ENV_TEST_BOOL_ONE = "1";
  assert.equal(envBool("ENV_TEST_BOOL_ONE"), true);

  process.env.ENV_TEST_BOOL_FALSE = "false";
  assert.equal(envBool("ENV_TEST_BOOL_FALSE"), false);

  delete process.env.ENV_TEST_BOOL_UNSET;
  assert.equal(envBool("ENV_TEST_BOOL_UNSET"), false);
  assert.equal(envBool("ENV_TEST_BOOL_UNSET", true), true);
});

test("envList splits on commas, trims, and drops empties", () => {
  process.env.ENV_TEST_LIST = "a, b ,,c";
  assert.deepEqual(envList("ENV_TEST_LIST"), ["a", "b", "c"]);

  delete process.env.ENV_TEST_LIST_UNSET;
  assert.deepEqual(envList("ENV_TEST_LIST_UNSET"), []);
  assert.deepEqual(envList("ENV_TEST_LIST_UNSET", ["x"]), ["x"]);
});
