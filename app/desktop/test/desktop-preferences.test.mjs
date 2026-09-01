import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DesktopPreferencesStore,
  resolveGeminiDefaults,
} from "../src/main/preferences/desktop-preferences.ts";

test("Gemini defaults use env values only inside the supported range", () => {
  assert.deepEqual(resolveGeminiDefaults({}), { characterTabs: 2, storyboardTabs: 4 });
  assert.deepEqual(
    resolveGeminiDefaults({
      NARRATIVEX_GEMINI_CHARACTER_TAB_COUNT: "3",
      NARRATIVEX_GEMINI_STORYBOARD_TAB_COUNT: "7",
    }),
    { characterTabs: 3, storyboardTabs: 7 },
  );
  assert.deepEqual(
    resolveGeminiDefaults({
      NARRATIVEX_GEMINI_CHARACTER_TAB_COUNT: "0",
      NARRATIVEX_GEMINI_STORYBOARD_TAB_COUNT: "100",
    }),
    { characterTabs: 2, storyboardTabs: 4 },
  );
});

test("preference profiles are isolated per user and reset to environment defaults", async () => {
  const directory = await mkdtemp(join(tmpdir(), "narrativex-preferences-"));
  const filePath = join(directory, "desktop-preferences.json");
  const store = new DesktopPreferencesStore(filePath, {
    NARRATIVEX_GEMINI_CHARACTER_TAB_COUNT: "3",
    NARRATIVEX_GEMINI_STORYBOARD_TAB_COUNT: "5",
  });

  await store.bindUser("user-a");
  await store.updateGemini({ characterTabs: 6, storyboardTabs: 8 });
  assert.deepEqual((await store.get()).gemini, {
    characterTabs: 6,
    storyboardTabs: 8,
    environmentDefaults: { characterTabs: 3, storyboardTabs: 5 },
  });

  await store.bindUser("user-b");
  assert.equal((await store.get()).gemini.characterTabs, 3);
  await store.updateGemini({ storyboardTabs: 2 });

  await store.bindUser("user-a");
  assert.equal((await store.get()).gemini.storyboardTabs, 8);
  await store.reset("GEMINI");
  assert.deepEqual((await store.get()).gemini, {
    characterTabs: 3,
    storyboardTabs: 5,
    environmentDefaults: { characterTabs: 3, storyboardTabs: 5 },
  });

  const persisted = JSON.parse(await readFile(filePath, "utf8"));
  assert.equal(persisted.lastActiveUserId, "user-a");
  assert.equal(persisted.profiles["user-b"].gemini.storyboardTabs, 2);
});

test("corrupted preference files recover without leaking invalid state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "narrativex-preferences-corrupt-"));
  const filePath = join(directory, "desktop-preferences.json");
  await writeFile(filePath, "{bad-json", "utf8");
  const store = new DesktopPreferencesStore(filePath, {});
  await store.bindUser("user-a");
  const preferences = await store.get();
  assert.equal(preferences.gemini.characterTabs, 2);
  assert.equal(preferences.window, null);
});

test("window state can be saved and reset independently", async () => {
  const directory = await mkdtemp(join(tmpdir(), "narrativex-preferences-window-"));
  const store = new DesktopPreferencesStore(join(directory, "desktop-preferences.json"), {});
  await store.bindUser("user-a");
  await store.updateWindow({ x: 10, y: 20, width: 1400, height: 900, maximized: true });
  assert.deepEqual((await store.get()).window, {
    x: 10,
    y: 20,
    width: 1400,
    height: 900,
    maximized: true,
  });
  await store.reset("WINDOW");
  assert.equal((await store.get()).window, null);
});
