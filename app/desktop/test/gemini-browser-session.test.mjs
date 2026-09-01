import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { classifyGeminiAuthSnapshot } from "../src/main/gemini-web/gemini-browser-session.ts";

const sessionSource = await readFile(
  new URL("../src/main/gemini-web/gemini-browser-session.ts", import.meta.url),
  "utf8",
);

test("Gemini composer means logged in", () => {
  assert.equal(classifyGeminiAuthSnapshot({ composer: true, signIn: false }), "LOGGED_IN");
});

test("Gemini sign-in UI means not logged in", () => {
  assert.equal(classifyGeminiAuthSnapshot({ composer: false, signIn: true }), "NOT_LOGGED_IN");
});

test("an indeterminate reachable page is unavailable rather than falsely authenticated", () => {
  assert.equal(classifyGeminiAuthSnapshot({ composer: false, signIn: false }), "UNAVAILABLE");
});

test("status checks are passive and only Open may start Chrome or create its control target", () => {
  const authStatusBody = sessionSource.match(/async authStatus\(\)[\s\S]*?\n  async login\(\)/)?.[0] ?? "";
  const loginBody = sessionSource.match(/async login\(\)[\s\S]*?\n  async open\(\)/)?.[0] ?? "";
  const openBody = sessionSource.match(/async open\(\)[\s\S]*?\n  async stop\(\)/)?.[0] ?? "";

  assert.doesNotMatch(authStatusBody, /ensureBrowser\(/);
  assert.doesNotMatch(authStatusBody, /ensureControlTarget\(/);
  assert.doesNotMatch(loginBody, /ensureBrowser\(/);
  assert.doesNotMatch(loginBody, /ensureControlTarget\(/);
  assert.match(openBody, /ensureBrowser\(/);
  assert.match(openBody, /ensureControlTarget\(/);
});
