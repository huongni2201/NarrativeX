import assert from "node:assert/strict";
import test from "node:test";
import { resolveStoryboardImagePreview } from "../src/renderer/features/storyboard/model/storyboard-image-preview.ts";

test("a generated local-only storyboard image uses the Desktop media preview URL", () => {
  const preview = resolveStoryboardImagePreview({
    projectId: "project-1",
    assetId: "asset-1",
    storageMode: "LOCAL_ONLY",
    remoteUrl: null,
  });

  assert.deepEqual(preview, {
    url: "narrativex-media://asset/project-1/asset-1",
    requiresRemoteUrl: false,
  });
});

test("a remote storyboard image keeps using its backend download URL", () => {
  const preview = resolveStoryboardImagePreview({
    projectId: "project-1",
    assetId: "asset-1",
    storageMode: "REMOTE",
    remoteUrl: "https://media.example.test/generated.png",
  });

  assert.deepEqual(preview, {
    url: "https://media.example.test/generated.png",
    requiresRemoteUrl: true,
  });
});
