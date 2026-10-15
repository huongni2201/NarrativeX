import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { IntegrityCache } from "../src/main/local-storage/integrity-cache.ts";

const sha = (text) => createHash("sha256").update(text).digest("hex");

async function fixture(content = "hello world") {
  const root = await mkdtemp(join(tmpdir(), "nx-integrity-"));
  const path = join(root, "asset.bin");
  await writeFile(path, content);
  return { root, path, cleanup: () => rm(root, { recursive: true, force: true }) };
}

function spyHash() {
  const calls = [];
  const { sha256File } = { sha256File: async (path) => path };
  return {
    calls,
    hashFile: async (path) => {
      calls.push(path);
      const { readFile } = await import("node:fs/promises");
      return createHash("sha256").update(await readFile(path)).digest("hex");
    },
    unused: sha256File,
  };
}

test("fifty concurrent fast verifications of one file hash it once", async () => {
  const { path, cleanup } = await fixture();
  try {
    const spy = spyHash();
    const cache = new IntegrityCache({ hashFile: spy.hashFile });
    const results = await Promise.all(
      Array.from({ length: 50 }, () => cache.verifyFile(path, sha("hello world"), "fast")),
    );
    assert.ok(results.every(Boolean));
    assert.equal(spy.calls.length, 1);
    // A later request is answered from the stat signature alone.
    assert.equal(await cache.verifyFile(path, sha("hello world"), "fast"), true);
    assert.equal(spy.calls.length, 1);
  } finally {
    await cleanup();
  }
});

test("changed content with a new mtime is re-hashed in fast mode and detected", async () => {
  const { path, cleanup } = await fixture("aaaa");
  try {
    const spy = spyHash();
    const cache = new IntegrityCache({ hashFile: spy.hashFile });
    assert.equal(await cache.verifyFile(path, sha("aaaa"), "fast"), true);
    await writeFile(path, "bbbb");
    const later = new Date(Date.now() + 5_000);
    await utimes(path, later, later);
    assert.equal(await cache.verifyFile(path, sha("aaaa"), "fast"), false);
    assert.equal(spy.calls.length, 2);
  } finally {
    await cleanup();
  }
});

test("full mode detects a same-size change whose mtime was restored", async () => {
  const { path, cleanup } = await fixture("aaaa");
  try {
    const cache = new IntegrityCache();
    assert.equal(await cache.verifyFile(path, sha("aaaa"), "fast"), true);
    const before = await stat(path);
    await writeFile(path, "bbbb");
    await utimes(path, before.atimeMs / 1000, before.mtimeMs / 1000);

    // Fast mode may or may not notice depending on timestamp precision; full mode always must.
    assert.equal(await cache.verifyFile(path, sha("aaaa"), "full"), false, "full mode always hashes");
  } finally {
    await cleanup();
  }
});

test("full mode never reuses a cached hash", async () => {
  const { path, cleanup } = await fixture();
  try {
    const spy = spyHash();
    const cache = new IntegrityCache({ hashFile: spy.hashFile });
    await cache.verifyFile(path, sha("hello world"), "full");
    await cache.verifyFile(path, sha("hello world"), "full");
    assert.equal(spy.calls.length, 2);
  } finally {
    await cleanup();
  }
});

test("the cache is an LRU bounded by maxEntries", async () => {
  const { root, cleanup } = await fixture();
  try {
    const cache = new IntegrityCache({ maxEntries: 3 });
    for (let index = 0; index < 6; index += 1) {
      const path = join(root, `file-${index}.bin`);
      await writeFile(path, `content-${index}`);
      await cache.verifyFile(path, sha(`content-${index}`), "fast");
    }
    assert.equal(cache.size, 3);
  } finally {
    await cleanup();
  }
});

test("invalidate forgets a path so the next fast check hashes again", async () => {
  const { path, cleanup } = await fixture();
  try {
    const spy = spyHash();
    const cache = new IntegrityCache({ hashFile: spy.hashFile });
    await cache.verifyFile(path, sha("hello world"), "fast");
    cache.invalidate(path);
    await cache.verifyFile(path, sha("hello world"), "fast");
    assert.equal(spy.calls.length, 2);
  } finally {
    await cleanup();
  }
});
