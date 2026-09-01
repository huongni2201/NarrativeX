import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GeminiBrowserStorage } from "../src/main/gemini-web/gemini-browser-storage.ts";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

test("legacy Browser 1 data migrates once and preserves login files", async () => {
  const legacyRoot = await mkdtemp(join(tmpdir(), "nx-gemini-storage-"));
  await mkdir(join(legacyRoot, "chrome-profile", "Default"), { recursive: true });
  await writeFile(join(legacyRoot, "chrome-profile", "Default", "Cookies"), "cookie-data", "utf8");
  await writeFile(join(legacyRoot, "session.json"), JSON.stringify({ port: 9222 }), "utf8");
  const storage = new GeminiBrowserStorage(legacyRoot);

  await storage.migrateLegacyBrowserOne("user-a");
  const browserRoot = storage.browserRoot("user-a", "browser-1");
  assert.equal(
    await readFile(join(browserRoot, "chrome-profile", "Default", "Cookies"), "utf8"),
    "cookie-data",
  );
  assert.equal(await exists(join(legacyRoot, "chrome-profile")), false);

  await storage.migrateLegacyBrowserOne("user-a");
  assert.equal(
    await readFile(join(browserRoot, "chrome-profile", "Default", "Cookies"), "utf8"),
    "cookie-data",
  );
});

test("reset login removes only selected browser session data", async () => {
  const legacyRoot = await mkdtemp(join(tmpdir(), "nx-gemini-reset-"));
  const storage = new GeminiBrowserStorage(legacyRoot);
  const first = storage.browserRoot("user-a", "browser-1");
  const second = storage.browserRoot("user-a", "browser-2");
  await mkdir(join(first, "chrome-profile"), { recursive: true });
  await mkdir(join(second, "chrome-profile"), { recursive: true });
  await writeFile(join(first, "session.json"), "{}", "utf8");
  await writeFile(join(second, "session.json"), "{}", "utf8");

  await storage.resetLogin("user-a", "browser-2");

  assert.equal(await exists(join(first, "chrome-profile")), true);
  assert.equal(await exists(join(first, "session.json")), true);
  assert.equal(await exists(join(second, "chrome-profile")), false);
  assert.equal(await exists(join(second, "session.json")), false);
});

test("remove browser data never deletes sibling browser roots", async () => {
  const legacyRoot = await mkdtemp(join(tmpdir(), "nx-gemini-remove-"));
  const storage = new GeminiBrowserStorage(legacyRoot);
  const first = storage.browserRoot("user-a", "browser-1");
  const second = storage.browserRoot("user-a", "browser-2");
  await mkdir(first, { recursive: true });
  await mkdir(second, { recursive: true });
  await writeFile(join(first, "keep.txt"), "keep", "utf8");
  await writeFile(join(second, "remove.txt"), "remove", "utf8");

  await storage.removeBrowserData("user-a", "browser-2");

  assert.equal(await readFile(join(first, "keep.txt"), "utf8"), "keep");
  assert.equal(await exists(second), false);
});
