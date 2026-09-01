import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path) {
  return readFileSync(path, "utf8");
}

test("Gemini browser management uses trusted main-process IPC", () => {
  const ipc = source("src/main/gemini-web/gemini-browser-ipc.ts");
  for (const channel of [
    "desktop:gemini-web:browsers:list",
    "desktop:gemini-web:browsers:add",
    "desktop:gemini-web:browsers:open",
    "desktop:gemini-web:browsers:login",
    "desktop:gemini-web:browsers:reset-login",
    "desktop:gemini-web:browsers:remove",
  ]) {
    assert.match(ipc, new RegExp(channel.replaceAll(":", "\\:")));
  }
  assert.match(ipc, /registerTrustedIpcHandler/);
  assert.match(ipc, /Invalid Gemini browser id/);
});

test("preload exposes browser management without exposing Chrome secrets", () => {
  const preload = source("src/preload/index.ts");
  const types = source("src/preload/types.ts");
  assert.match(preload, /browsers:/);
  assert.match(preload, /resetLogin/);
  assert.match(types, /GeminiBrowserView/);
  assert.doesNotMatch(types, /profilePath:/);
  assert.doesNotMatch(types, /cookie:/i);
  assert.doesNotMatch(types, /remoteDebuggingPort/);
});

test("generation requests stay browser agnostic", () => {
  const types = source("src/preload/types.ts");
  const match = types.match(/export interface GeminiWebGenerateImageInput \{([\s\S]*?)\n\}/);
  assert.ok(match);
  assert.doesNotMatch(match[1], /browserId/);
});
