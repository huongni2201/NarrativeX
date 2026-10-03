import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256File, isMissingFile } from "../src/main/local-storage/file-integrity.ts";

test("streaming file digest keeps known vectors and propagates errors", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "nx-integrity-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "input");
  await writeFile(path, "abc");
  assert.equal(await sha256File(path), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  await writeFile(path, "");
  assert.equal(await sha256File(path), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  await assert.rejects(sha256File(join(root, "missing")), isMissingFile);
  assert.equal(isMissingFile({ code: "EACCES" }), false);
  assert.equal(isMissingFile(null), false);
  assert.equal(isMissingFile("ENOENT"), false);
});
