import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path) {
  return readFileSync(path, "utf8");
}

test("main entrypoint stays thin while personalized preferences own native persistence", () => {
  const main = source("src/main/main.ts");
  const bootstrap = source("src/main/preferences/preferences-bootstrap.ts");
  const preferencesIpc = source("src/main/preferences/desktop-preferences-ipc.ts");

  assert.match(main, /bootstrap-core/);
  assert.match(main, /preferences\/preferences-bootstrap/);
  assert.doesNotMatch(main, /new BrowserWindow\(/);
  assert.doesNotMatch(main, /desktop:preferences:/);

  assert.match(bootstrap, /resolveRestoredWindowState/);
  assert.match(bootstrap, /getNormalBounds\(\)/);
  assert.match(bootstrap, /registerDesktopPreferencesIpc/);

  assert.match(preferencesIpc, /desktop:preferences:get/);
  assert.match(preferencesIpc, /desktop:preferences:update-gemini/);
  assert.match(preferencesIpc, /desktop:preferences:reset/);
});

test("Gemini scheduling lives in focused pool modules", () => {
  const automationPool = source("src/main/gemini-web/gemini-web-automation-pool.ts");
  const slotPool = source("src/main/gemini-web/gemini-web-slot-pool.ts");
  const browserPool = source("src/main/gemini-web/gemini-browser-pool.ts");
  const browserSession = source("src/main/gemini-web/gemini-browser-session.ts");
  const browserStorage = source("src/main/gemini-web/gemini-browser-storage.ts");
  const ipc = source("src/main/gemini-web/gemini-web-ipc.ts");

  assert.match(slotPool, /class GeminiWebSlotPool/);
  assert.match(slotPool, /acquire/);
  assert.match(slotPool, /release/);
  assert.match(automationPool, /GeminiWebSlotPool/);
  assert.match(browserPool, /class GeminiBrowserPool/);
  assert.match(browserSession, /class GeminiBrowserSession/);
  assert.match(browserStorage, /class GeminiBrowserStorage/);
  assert.match(ipc, /GeminiBrowserPool/);
});

test("multi-browser responsibilities stay out of the large page-automation file", () => {
  const automation = source("src/main/gemini-web/gemini-web-automation.ts");
  assert.doesNotMatch(automation, /GeminiBrowserPool/);
  assert.doesNotMatch(automation, /GeminiBrowserStorage/);
  assert.doesNotMatch(automation, /addGeminiBrowser/);
  assert.doesNotMatch(automation, /removeGeminiBrowser/);
});
