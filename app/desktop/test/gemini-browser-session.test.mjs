import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sessionSource = await readFile(
  new URL("../src/main/gemini-web/gemini-browser-session.ts", import.meta.url),
  "utf8",
);

test("Gemini browser session owns opening Chrome but no automatic login detection", () => {
  assert.match(sessionSource, /async open\(\)/);
  assert.match(sessionSource, /ensureBrowser\(/);
  assert.match(sessionSource, /ensureControlTarget\(/);
  assert.doesNotMatch(sessionSource, /classifyGeminiAuthSnapshot/);
  assert.doesNotMatch(sessionSource, /async authStatus\(\)/);
  assert.doesNotMatch(sessionSource, /async login\(\)/);
  assert.doesNotMatch(sessionSource, /authSnapshot\(/);
});
