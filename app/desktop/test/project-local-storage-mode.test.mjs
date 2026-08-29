import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contracts = await readFile(
  new URL("../../../packages/client-contracts/src/production.ts", import.meta.url),
  "utf8",
);
const manifest = await readFile(
  new URL("../src/main/rendering/render-manifest.ts", import.meta.url),
  "utf8",
);
const preflight = await readFile(
  new URL("../src/renderer/features/production/render-preflight.ts", import.meta.url),
  "utf8",
);

test("project media is implicitly local without storage-mode branching", () => {
  assert.doesNotMatch(contracts, /BeatMediaStorageMode|storageMode|PROJECT_LOCAL|LOCAL_ONLY|HYBRID/);
  assert.doesNotMatch(manifest, /storageMode|PROJECT_LOCAL|LOCAL_ONLY|HYBRID/);
  assert.doesNotMatch(preflight, /storageMode|materializable|PROJECT_LOCAL|LOCAL_ONLY|HYBRID/);
});
