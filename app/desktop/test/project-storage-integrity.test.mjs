import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { IntegrityCache } from "../src/main/local-storage/integrity-cache.ts";
import { ProjectStorage } from "../src/main/local-storage/project-storage.ts";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const sha = (text) => createHash("sha256").update(text).digest("hex");

async function setup(options) {
  const root = await mkdtemp(join(tmpdir(), "nx-storage-"));
  const source = join(root, "source.png");
  await writeFile(source, "image-bytes-1");
  const storage = new ProjectStorage(join(root, "projects"), options);
  return { root, source, storage, cleanup: () => rm(root, { recursive: true, force: true }) };
}

function countingCache() {
  const calls = [];
  const cache = new IntegrityCache({
    hashFile: async (path) => {
      calls.push(path);
      return createHash("sha256").update(await readFile(path)).digest("hex");
    },
  });
  return { cache, calls };
}

test("ensureProject builds the layout once per process and then only reads the manifest", async () => {
  const { storage, root, cleanup } = await setup();
  try {
    await storage.ensureProject(PROJECT);
    const segments = join(root, "projects", PROJECT, "cache", "segments");
    assert.ok(existsSync(segments));
    await rm(segments, { recursive: true });

    for (let index = 0; index < 100; index += 1) await storage.ensureProject(PROJECT);
    assert.equal(existsSync(segments), false, "layout must not be recreated on the hot path");

    await rm(join(root, "projects", PROJECT), { recursive: true });
    await storage.ensureProject(PROJECT);
    assert.ok(existsSync(segments), "a removed project directory is rebuilt");
  } finally {
    await cleanup();
  }
});

test("a written manifest is visible to the next read without stale cache", async () => {
  const { storage, source, cleanup } = await setup();
  try {
    assert.deepEqual(Object.keys((await storage.ensureProject(PROJECT)).assets), []);
    await storage.registerAsset(PROJECT, { assetId: "asset-1", kind: "IMAGE", sourcePath: source });
    assert.deepEqual(Object.keys((await storage.ensureProject(PROJECT)).assets), ["asset-1"]);

    // Callers get private copies: mutating one must not leak into later reads.
    const mutated = await storage.ensureProject(PROJECT);
    delete mutated.assets["asset-1"];
    assert.deepEqual(Object.keys((await storage.ensureProject(PROJECT)).assets), ["asset-1"]);
  } finally {
    await cleanup();
  }
});

test("a manifest changed by another process is picked up through its stat signature", async () => {
  const { storage, source, root, cleanup } = await setup();
  try {
    await storage.registerAsset(PROJECT, { assetId: "asset-1", kind: "IMAGE", sourcePath: source });
    await storage.ensureProject(PROJECT);
    const manifestPath = join(root, "projects", PROJECT, "project.manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    delete manifest.assets["asset-1"];
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const later = new Date(Date.now() + 5_000);
    await utimes(manifestPath, later, later);

    assert.deepEqual(Object.keys((await storage.ensureProject(PROJECT)).assets), []);
  } finally {
    await cleanup();
  }
});

test("fifty concurrent fast previews hash the asset once", async () => {
  const { cache, calls } = countingCache();
  const { storage, source, cleanup } = await setup({ integrityCache: cache });
  try {
    await storage.registerAsset(PROJECT, { assetId: "asset-1", kind: "IMAGE", sourcePath: source });
    cache.invalidate(await storage.resolveAsset(PROJECT, "asset-1", undefined, "fast"));
    calls.length = 0;

    await Promise.all(
      Array.from({ length: 50 }, () => storage.resolveAsset(PROJECT, "asset-1", undefined, "fast")),
    );
    assert.ok(calls.length <= 1, `expected at most one hash, saw ${calls.length}`);
  } finally {
    await cleanup();
  }
});

test("edited content with a new mtime fails fast resolution", async () => {
  const { storage, source, cleanup } = await setup();
  try {
    const entry = await storage.registerAsset(PROJECT, { assetId: "asset-1", kind: "IMAGE", sourcePath: source });
    const path = await storage.resolveAsset(PROJECT, "asset-1", undefined, "fast");
    await writeFile(path, "tampered-bytes");
    const later = new Date(Date.now() + 5_000);
    await utimes(path, later, later);
    assert.equal(entry.sizeBytes === (await stat(path)).size, false);
    await assert.rejects(storage.resolveAsset(PROJECT, "asset-1", undefined, "fast"), /size|checksum/);
  } finally {
    await cleanup();
  }
});

test("full resolution catches a same-size same-mtime change", async () => {
  const { storage, source, cleanup } = await setup();
  try {
    await storage.registerAsset(PROJECT, { assetId: "asset-1", kind: "IMAGE", sourcePath: source });
    const path = await storage.resolveAsset(PROJECT, "asset-1", undefined, "fast");
    const before = await stat(path);
    await writeFile(path, "image-bytes-2"); // same length as "image-bytes-1"
    await utimes(path, before.atime, before.mtime);

    await assert.rejects(storage.resolveAsset(PROJECT, "asset-1"), /checksum/);
    const verification = await storage.verifyAssets(PROJECT);
    assert.equal(verification[0].state, "CORRUPT");
  } finally {
    await cleanup();
  }
});

test("resolveAsset still enforces an explicit expected checksum in full mode", async () => {
  const { storage, source, cleanup } = await setup();
  try {
    await storage.registerAsset(PROJECT, { assetId: "asset-1", kind: "IMAGE", sourcePath: source });
    await assert.doesNotReject(
      storage.resolveAsset(PROJECT, "asset-1", { checksumSha256: sha("image-bytes-1") }),
    );
    await assert.rejects(
      storage.resolveAsset(PROJECT, "asset-1", { checksumSha256: sha("other") }),
      /checksum/,
    );
  } finally {
    await cleanup();
  }
});
