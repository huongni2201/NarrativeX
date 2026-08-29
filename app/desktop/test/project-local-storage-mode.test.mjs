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

test("Desktop accepts backend PROJECT_LOCAL media assets", () => {
  assert.match(contracts, /BeatMediaStorageMode[^\n]*PROJECT_LOCAL/s);
  assert.match(manifest, /\["REMOTE",\s*"PROJECT_LOCAL",\s*"LOCAL_ONLY",\s*"HYBRID"\]/);
});
