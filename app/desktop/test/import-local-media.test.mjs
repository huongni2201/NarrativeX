import assert from "node:assert/strict";
import test from "node:test";
import { assetsApi } from "../src/renderer/features/assets/api/assets.api.ts";
import { importLocalMedia } from "../src/renderer/features/assets/services/import-local-media.ts";

const selection = (kind) => ({
  selectionToken: "selection-1",
  originalFilename: kind === "IMAGE" ? "poster.png" : "clip.mp4",
  contentType: kind === "IMAGE" ? "image/png" : "video/mp4",
  sizeBytes: 10,
  checksumSha256: "a".repeat(64),
  durationMs: kind === "VIDEO" ? 1000 : null,
  kind,
});

test("image-only preview import rejects video before asset registration", async () => {
  const originalRegister = assetsApi.registerLocal;
  const originalWindow = globalThis.window;
  let registrations = 0;
  globalThis.window = { narrativex: { localStorage: { selectAsset: async () => selection("VIDEO") } } };
  assetsApi.registerLocal = async () => {
    registrations += 1;
    return { id: "unexpected" };
  };

  try {
    await assert.rejects(
      importLocalMedia({ projectId: "project-1", allowedKinds: ["IMAGE"] }),
      /VIDEO/,
    );
    assert.equal(registrations, 0);
  } finally {
    assetsApi.registerLocal = originalRegister;
    globalThis.window = originalWindow;
  }
});

test("failed local commit unregisters the backend asset", async () => {
  const originalRegister = assetsApi.registerLocal;
  const originalRemove = assetsApi.remove;
  const originalWindow = globalThis.window;
  const removed = [];
  globalThis.window = {
    narrativex: {
      localStorage: {
        selectAsset: async () => selection("IMAGE"),
        commitSelectedAsset: async () => {
          throw new Error("local commit failed");
        },
      },
    },
  };
  assetsApi.registerLocal = async () => ({ id: "asset-1" });
  assetsApi.remove = async (...args) => removed.push(args);

  try {
    await assert.rejects(
      importLocalMedia({ projectId: "project-1", allowedKinds: ["IMAGE"] }),
      /local commit failed/,
    );
    assert.deepEqual(removed, [["project-1", "asset-1"]]);
  } finally {
    assetsApi.registerLocal = originalRegister;
    if (originalRemove === undefined) delete assetsApi.remove;
    else assetsApi.remove = originalRemove;
    globalThis.window = originalWindow;
  }
});
