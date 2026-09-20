import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (...parts) => readFileSync(parts.join("/"), "utf8");

test("preload exposes an application-scoped preferences bridge", () => {
  const types = source("src", "preload", "types.ts");
  const preload = source("src", "preload", "index.ts");
  assert.match(types, /preferences:\s*\{/);
  const desktopPreferences = types.match(/export interface DesktopPreferences \{[\s\S]*?\n\}/u)?.[0] ?? "";
  const preferencesBridge = types.match(/  preferences: \{[\s\S]*?\n  \};/u)?.[0] ?? "";
  const preloadPreferences = preload.match(/  preferences: \{[\s\S]*?\n  \},/u)?.[0] ?? "";
  assert.match(desktopPreferences, /window: DesktopWindowPreference \| null/);
  assert.doesNotMatch(desktopPreferences, /userId|bindUser/);
  assert.match(preferencesBridge, /get\(\): Promise<DesktopPreferences>/);
  assert.match(preferencesBridge, /reset\(scope: DesktopPreferenceResetScope\)/);
  assert.doesNotMatch(preferencesBridge, /userId|bindUser/);
  assert.doesNotMatch(preloadPreferences, /desktop:preferences:bind-user|bindUser/);
  assert.match(preloadPreferences, /desktop:preferences:reset/);
});

test("application preference bootstrap restores and persists native window state", () => {
  const main = source("src", "main", "main.ts");
  const bootstrap = source("src", "main", "preferences", "preferences-bootstrap.ts");
  const ipc = source("src", "main", "preferences", "desktop-preferences-ipc.ts");
  assert.match(main, /preferences\/preferences-bootstrap/);
  assert.match(bootstrap, /DesktopPreferencesStore/);
  assert.match(bootstrap, /resolveRestoredWindowState/);
  assert.match(bootstrap, /getNormalBounds\(\)/);
  assert.match(bootstrap, /\.get\(\)/);
  assert.doesNotMatch(ipc, /desktop:preferences:bind-user|bindUser|userId/);
  assert.match(ipc, /desktop:preferences:reset/);
});

test("Settings exposes only application-scoped Desktop reset controls", () => {
  const settings = source("src", "renderer", "features", "settings", "screens", "SettingsScreen.tsx");
  assert.match(settings, /Reset window layout/);
  assert.match(settings, /Reset all application settings/);
  assert.doesNotMatch(settings, /\buser\b|account|login|logout/i);
});
