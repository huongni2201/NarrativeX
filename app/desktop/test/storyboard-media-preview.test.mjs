import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { resolveStoryboardImagePreview } from "../src/renderer/features/storyboard/model/storyboard-image-preview.ts";

const desktopRoot = resolve(dirname(import.meta.filename), "..");
const source = readFileSync(
  join(
    desktopRoot,
    "src",
    "renderer",
    "features",
    "storyboard",
    "model",
    "storyboard-image-preview.ts",
  ),
  "utf8",
);

test("storyboard images always resolve through the project-local media protocol", () => {
  const preview = resolveStoryboardImagePreview({
    projectId: "project-1",
    assetId: "asset-1",
  });

  assert.deepEqual(preview, {
    url: "narrativex-media://asset/project-1/asset-1",
  });
});

test("storyboard preview has no remote or storage-mode fallback", () => {
  assert.match(source, /localAssetPreviewUrl\s*\(\s*input\.projectId\s*,\s*input\.assetId/);
  assert.doesNotMatch(source, /remoteUrl|requiresRemoteUrl|storageMode|LOCAL_ONLY|REMOTE|HYBRID|PROJECT_LOCAL/);
});
