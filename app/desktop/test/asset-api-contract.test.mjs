import assert from "node:assert/strict";
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
