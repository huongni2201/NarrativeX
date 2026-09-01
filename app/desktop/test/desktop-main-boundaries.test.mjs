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
  const ipc = source("src/main/gemini-web/gemini-web-ipc.ts");

  assert.match(slotPool, /class GeminiWebSlotPool/);
  assert.match(slotPool, /acquire/);
  assert.match(slotPool, /release/);
  assert.match(automationPool, /GeminiWebSlotPool/);
  assert.match(ipc, /GeminiWebAutomationPool/);
});

test("Gemini page automation no longer owns Chrome process or socket discovery", () => {
  const automation = source("src/main/gemini-web/gemini-web-automation.ts");
  const session = source("src/main/gemini-web/gemini-chrome-session.ts");

  assert.doesNotMatch(automation, /node:child_process/);
  assert.doesNotMatch(automation, /node:net/);
  assert.doesNotMatch(automation, /spawn\(/);
  assert.match(session, /node:child_process/);
  assert.match(session, /node:net/);
  assert.match(session, /class GeminiChromeSession/);
});
