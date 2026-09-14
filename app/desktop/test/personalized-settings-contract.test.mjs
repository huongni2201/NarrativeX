import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (...parts) => readFileSync(parts.join("/"), "utf8");

test("preload exposes a typed per-user preferences bridge", () => {
  const types = source("src", "preload", "types.ts");
  const preload = source("src", "preload", "index.ts");
  assert.match(types, /preferences:\s*\{/);
  assert.match(types, /bindUser\(userId: string\)/);
  assert.match(types, /reset\(scope: DesktopPreferenceResetScope\)/);
  assert.match(preload, /desktop:preferences:bind-user/);
  assert.match(preload, /desktop:preferences:reset/);
});

test("AuthGuard blocks account-scoped children until desktop preferences bind to the current user", () => {
  const authGuard = source("src", "renderer", "features", "auth", "AuthGuard.tsx");
  assert.match(authGuard, /boundPreferenceUserId/);
  assert.match(authGuard, /setBoundPreferenceUserId\(undefined\)/);
  assert.match(authGuard, /const preferenceUserId = currentUser\.data\.id/);
  assert.match(
    authGuard,
    /window\.narrativex\.preferences\s*\.bindUser\(currentUser\.data\.id\)/,
  );
  assert.match(authGuard, /setBoundPreferenceUserId\(preferenceUserId\)/);
  assert.match(authGuard, /syncingPreferenceIdentity/);
  assert.match(authGuard, /syncingLocalIdentity\s*\|\|\s*syncingPreferenceIdentity/);
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

test("Settings exposes only active Desktop reset controls", () => {
  const settings = source("src", "renderer", "features", "settings", "screens", "SettingsScreen.tsx");
  assert.match(settings, /Reset window layout/);
  assert.match(settings, /Reset all personalized settings/);
});
