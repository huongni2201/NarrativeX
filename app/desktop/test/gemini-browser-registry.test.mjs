import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GEMINI_BROWSER_ID,
  addGeminiBrowserProfile,
  defaultGeminiBrowserProfile,
  geminiBrowserUserKey,
  removeGeminiBrowserProfile,
  sanitizeGeminiBrowserProfiles,
  setGeminiBrowserLoginConfirmed,
} from "../src/main/gemini-web/gemini-browser-registry.ts";

test("a fresh Gemini registry contains Browser 1 as unconfirmed", () => {
  assert.deepEqual(defaultGeminiBrowserProfile(new Date("2026-09-01T00:00:00.000Z")), {
    id: DEFAULT_GEMINI_BROWSER_ID,
    name: "Browser 1",
    createdAt: "2026-09-01T00:00:00.000Z",
    loginConfirmed: false,
  });
});

test("adding a browser creates a unique unconfirmed profile", () => {
  const first = [defaultGeminiBrowserProfile(new Date("2026-09-01T00:00:00.000Z"))];
  const next = addGeminiBrowserProfile(first, new Date("2026-09-01T00:01:00.000Z"));
  assert.equal(next.length, 2);
  assert.equal(next[1].name, "Browser 2");
  assert.equal(next[1].loginConfirmed, false);
  assert.notEqual(next[1].id, first[0].id);
  assert.match(next[1].id, /^browser-[A-Za-z0-9-]+$/);
});

test("manual login confirmation is persisted by sanitization", () => {
  const confirmed = setGeminiBrowserLoginConfirmed(
    [defaultGeminiBrowserProfile(new Date("2026-09-01T00:00:00.000Z"))],
    DEFAULT_GEMINI_BROWSER_ID,
    true,
  );
  assert.equal(confirmed[0].loginConfirmed, true);
  assert.equal(sanitizeGeminiBrowserProfiles(confirmed)[0].loginConfirmed, true);
});

test("the final browser cannot be removed", () => {
  const first = [defaultGeminiBrowserProfile()];
  assert.throws(
    () => removeGeminiBrowserProfile(first, DEFAULT_GEMINI_BROWSER_ID),
    /at least one/i,
  );
});

test("user directory keys never expose raw user ids", () => {
  const key = geminiBrowserUserKey("../../user@example.com");
  assert.match(key, /^[a-f0-9]{32}$/);
  assert.equal(key.includes(".."), false);
  assert.equal(key.includes("@"), false);
});
