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

test("browser roots are scoped by current user and browser id", async () => {
  const storageRoot = await mkdtemp(join(tmpdir(), "nx-gemini-storage-"));
  const storage = new GeminiBrowserStorage(storageRoot);

  assert.notEqual(storage.browserRoot("user-a", "browser-1"), storage.browserRoot("user-a", "browser-2"));
  assert.notEqual(storage.browserRoot("user-a", "browser-1"), storage.browserRoot("user-b", "browser-1"));
  assert.throws(() => storage.browserRoot("user-a", "../escape"), /Invalid Gemini browser id/);
});

test("reset login removes only selected browser session data", async () => {
  const storageRoot = await mkdtemp(join(tmpdir(), "nx-gemini-reset-"));
  const storage = new GeminiBrowserStorage(storageRoot);
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
  const storageRoot = await mkdtemp(join(tmpdir(), "nx-gemini-remove-"));
  const storage = new GeminiBrowserStorage(storageRoot);
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
