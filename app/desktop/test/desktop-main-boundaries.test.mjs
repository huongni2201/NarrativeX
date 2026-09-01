import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path) {
  return readFileSync(path, "utf8");
}

test("main process delegates personalized preferences and window lifecycle to focused modules", () => {
  const main = source("src/main/main.ts");
  const windowLifecycle = source("src/main/window/main-window.ts");
  const preferencesIpc = source("src/main/preferences/desktop-preferences-ipc.ts");

  assert.match(main, /createMainWindow/);
  assert.match(main, /registerDesktopPreferencesIpc/);
  assert.doesNotMatch(main, /new BrowserWindow\(/);
  assert.doesNotMatch(main, /desktop:preferences:/);

  assert.match(windowLifecycle, /new BrowserWindow\(/);
  assert.match(windowLifecycle, /resolveWindowState/);
  assert.match(windowLifecycle, /getNormalBounds\(\)/);

  assert.match(preferencesIpc, /desktop:preferences:get/);
  assert.match(preferencesIpc, /desktop:preferences:update-gemini/);
  assert.match(preferencesIpc, /desktop:preferences:reset/);
});

test("Gemini scheduling lives in a focused slot-pool module", () => {
  const automation = source("src/main/gemini-web/gemini-web-automation.ts");
  const pool = source("src/main/gemini-web/gemini-web-slot-pool.ts");

  assert.match(pool, /class GeminiWebSlotPool/);
  assert.match(pool, /acquire/);
  assert.match(pool, /release/);
  assert.match(automation, /GeminiWebSlotPool/);
});
