import test from "node:test";
import assert from "node:assert/strict";
import {
  localAssetPreviewUrl,
  parseLocalAssetPreviewUrl,
} from "../src/shared/local-asset-preview-url.ts";

test("local preview URL round-trips project and asset ids", () => {
  const url = localAssetPreviewUrl("project-1", "asset-2");
  assert.equal(url, "narrativex-media://asset/project-1/asset-2");
  assert.deepEqual(parseLocalAssetPreviewUrl(url), {
    projectId: "project-1",
    assetId: "asset-2",
  });
});

test("local preview parser rejects foreign and malformed URLs", () => {
  assert.equal(parseLocalAssetPreviewUrl("https://asset/project-1/asset-2"), null);
  assert.equal(parseLocalAssetPreviewUrl("narrativex-media://other/project-1/asset-2"), null);
  assert.equal(parseLocalAssetPreviewUrl("narrativex-media://asset/project-1"), null);
});
