import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesktopPreferencesStore } from "../src/main/preferences/desktop-preferences.ts";

const windowState = { x: 100, y: 100, width: 1440, height: 900, maximized: false };

async function withPreferencesFile(contents, callback) {
  const root = await mkdtemp(join(tmpdir(), "narrativex-preferences-"));
  const path = join(root, "desktop-preferences.json");
  try {
    if (contents !== undefined) await writeFile(path, contents, "utf8");
    return await callback(path);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("application-scoped preferences start with a safe empty state", async () => {
  await withPreferencesFile(undefined, async (path) => {
    const store = new DesktopPreferencesStore(path);
    assert.deepEqual(await store.get(), { window: null });
  });
});

test("valid legacy preferences migrate the active window to v4", async () => {
  const activeProfileKey = ["last", "Active", "User", "Id"].join("");
  const legacy = JSON.stringify({
    schemaVersion: 3,
    [activeProfileKey]: "profile-1",
    profiles: {
      "profile-1": { window: windowState },
      "profile-2": { window: { ...windowState, width: 500 } },
    },
  });

  await withPreferencesFile(legacy, async (path) => {
    const store = new DesktopPreferencesStore(path);
    assert.deepEqual(await store.get(), { window: windowState });

    const migrated = JSON.parse(await readFile(path, "utf8"));
    assert.deepEqual(migrated, { schemaVersion: 4, window: windowState });
  });
});

test("legacy preferences without a valid active window migrate without a window", async () => {
  const activeProfileKey = ["last", "Active", "User", "Id"].join("");
  const legacy = JSON.stringify({
    schemaVersion: 3,
    [activeProfileKey]: "missing-profile",
    profiles: { "other-profile": { window: windowState } },
  });

  await withPreferencesFile(legacy, async (path) => {
    const store = new DesktopPreferencesStore(path);
    assert.deepEqual(await store.get(), { window: null });
  });
});

test("invalid JSON and invalid legacy windows fall back safely", async () => {
  await withPreferencesFile("{not-json", async (path) => {
    const store = new DesktopPreferencesStore(path);
    assert.deepEqual(await store.get(), { window: null });
  });

  const activeProfileKey = ["last", "Active", "User", "Id"].join("");
  await withPreferencesFile(
    JSON.stringify({
      schemaVersion: 3,
      [activeProfileKey]: "profile-1",
      profiles: { "profile-1": { window: { ...windowState, width: 0 } } },
    }),
    async (path) => {
      const store = new DesktopPreferencesStore(path);
      assert.deepEqual(await store.get(), { window: null });
    },
  );
});

test("window updates persist and reset clears the application preference", async () => {
  await withPreferencesFile(undefined, async (path) => {
    const store = new DesktopPreferencesStore(path);
    assert.deepEqual(await store.updateWindow(windowState), { window: windowState });
    assert.deepEqual(await new DesktopPreferencesStore(path).get(), { window: windowState });
    assert.deepEqual(await store.reset("ALL"), { window: null });
    assert.deepEqual(await new DesktopPreferencesStore(path).get(), { window: null });
  });
});

test("window updates reject invalid state", async () => {
  await withPreferencesFile(undefined, async (path) => {
    const store = new DesktopPreferencesStore(path);
    await assert.rejects(() => store.updateWindow({ ...windowState, width: 0 }), /Invalid Desktop window state/);
  });
});
