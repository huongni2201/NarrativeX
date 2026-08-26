import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { toRegisterLocalAssetRequest } from "../src/renderer/features/assets/api/assets.api.ts";

test("local asset API request strips desktop-only registration fields", () => {
  assert.deepEqual(
    toRegisterLocalAssetRequest({
      projectId: "project-1",
      assetId: "local-placeholder",
      type: "VIDEO",
      originalFilename: "clip.mp4",
      contentType: "video/mp4",
      sizeBytes: 1234,
      checksumSha256: "a".repeat(64),
      durationMs: 5000,
    }),
    {
      type: "VIDEO",
      originalFilename: "clip.mp4",
      contentType: "video/mp4",
      sizeBytes: 1234,
      checksumSha256: "a".repeat(64),
      durationMs: 5000,
    },
  );
});

test("asset API paginates safely and supports screen-scoped media loading", () => {
  const source = readFileSync(
    new URL("../src/renderer/features/assets/api/assets.api.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /const ASSET_PAGE_LIMIT = 100/);
  assert.match(source, /export type AssetLibraryScope = "all" \| "audio" \| "visual"/);
  assert.match(source, /const seenCursors = new Set<string>\(\)/);
  assert.match(source, /params\.set\("type", type\)/);
  assert.match(source, /listAllByType\("AUDIO"\)/);
  assert.match(source, /Promise\.all\(\[listAllByType\("IMAGE"\), listAllByType\("VIDEO"\)\]\)/);
});
