import test from "node:test";
import assert from "node:assert/strict";
import { classifyGeminiAuthSnapshot } from "../src/main/gemini-web/gemini-chrome-session.ts";

test("Gemini composer means logged in", () => {
  assert.equal(
    classifyGeminiAuthSnapshot({ composer: true, signIn: false }),
    "LOGGED_IN",
  );
});

test("Gemini sign-in UI means not logged in", () => {
  assert.equal(
    classifyGeminiAuthSnapshot({ composer: false, signIn: true }),
    "NOT_LOGGED_IN",
  );
});

test("an indeterminate reachable page is unavailable rather than falsely authenticated", () => {
  assert.equal(
    classifyGeminiAuthSnapshot({ composer: false, signIn: false }),
    "UNAVAILABLE",
  );
});
