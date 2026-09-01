import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (...parts) => readFileSync(parts.join("/"), "utf8");

test("preload exposes a typed per-user preferences bridge", () => {
  const types = source("src", "preload", "types.ts");
  const preload = source("src", "preload", "index.ts");
  assert.match(types, /preferences:\s*\{/);
  assert.match(types, /bindUser\(userId: string\)/);
  assert.match(types, /updateGemini/);
  assert.match(types, /reset\(scope: DesktopPreferenceResetScope\)/);
  assert.match(preload, /desktop:preferences:bind-user/);
  assert.match(preload, /desktop:preferences:update-gemini/);
  assert.match(preload, /desktop:preferences:reset/);
});

test("AuthGuard binds desktop preferences to the resolved current user", () => {
  const authGuard = source("src", "renderer", "features", "auth", "AuthGuard.tsx");
  assert.match(authGuard, /window\.narrativex\.preferences\.bindUser\(currentUser\.data\.id\)/);
});

test("personalized preference bootstrap restores and persists native window state", () => {
  const main = source("src", "main", "main.ts");
  const bootstrap = source("src", "main", "preferences", "preferences-bootstrap.ts");
  const ipc = source("src", "main", "preferences", "desktop-preferences-ipc.ts");
  assert.match(main, /preferences\/preferences-bootstrap/);
  assert.match(bootstrap, /DesktopPreferencesStore/);
  assert.match(bootstrap, /resolveRestoredWindowState/);
  assert.match(bootstrap, /getNormalBounds\(\)/);
  assert.match(ipc, /desktop:preferences:bind-user/);
  assert.match(ipc, /desktop:preferences:reset/);
});

test("Settings exposes Gemini concurrency and reset actions", () => {
  const settings = source("src", "renderer", "features", "settings", "screens", "SettingsScreen.tsx");
  assert.match(settings, /Gemini Image Generation/);
  assert.match(settings, /Character parallel tabs/);
  assert.match(settings, /Storyboard parallel tabs/);
  assert.match(settings, /Reset Gemini generation settings/);
  assert.match(settings, /Reset window layout/);
  assert.match(settings, /Reset all personalized settings/);
  assert.match(settings, /environmentDefaults/);
});
