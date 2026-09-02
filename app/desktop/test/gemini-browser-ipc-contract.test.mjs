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
    "desktop:gemini-web:browsers:set-login-confirmed",
    "desktop:gemini-web:browsers:reset-login",
    "desktop:gemini-web:browsers:remove",
  ]) {
    assert.match(ipc, new RegExp(channel.replaceAll(":", "\\:")));
  }
  assert.doesNotMatch(ipc, /desktop:gemini-web:browsers:login/);
  assert.match(ipc, /registerTrustedIpcHandler/);
  assert.match(ipc, /Invalid Gemini browser id/);
  assert.match(ipc, /Invalid Gemini browser login confirmation/);
});

test("preload exposes manual login confirmation without exposing Chrome secrets", () => {
  const preload = source("src/preload/index.ts");
  const types = source("src/preload/types.ts");
  assert.match(preload, /browsers:/);
  assert.match(preload, /setLoginConfirmed/);
  assert.match(preload, /set-login-confirmed/);
  assert.doesNotMatch(preload, /gemini-web:browsers:login/);
  assert.match(types, /GeminiBrowserView/);
  assert.match(types, /loginConfirmed: boolean/);
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
