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
  assert.match(preferencesIpc, /desktop:preferences:reset/);
});
