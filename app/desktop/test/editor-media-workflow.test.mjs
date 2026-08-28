import assert from "node:assert/strict";
import test from "node:test";
import {
  EditorMediaAttachError,
  persistEditorMedia,
  validateEditorMediaSelection,
} from "../src/renderer/features/editor/model/editor-media-workflow.ts";

const imageSelection = {
  selectionToken: "selection-1",
  originalFilename: "frame.png",
  contentType: "image/png",
  sizeBytes: 1024,
  checksumSha256: "abc123",
  durationMs: null,
  kind: "IMAGE",
};

test("editor media import keeps register -> trusted commit -> attach ordering", async () => {
  const events = [];
  const result = await persistEditorMedia(
    {
      registerLocal: async (input) => {
        events.push(["register", input]);
        return {
          id: "asset-1",
          originalFilename: input.originalFilename,
          durationMs: input.durationMs,
        };
      },
      commitSelectedAsset: async (input) => {
        events.push(["commit", input]);
      },
      updateBeatMedia: async (projectId, beatId, input) => {
        events.push(["attach", { projectId, beatId, ...input }]);
      },
    },
    {
      projectId: "project-1",
      beatId: "beat-1",
      beatDurationMs: 5000,
      selection: imageSelection,
    },
  );

  assert.deepEqual(events.map(([name]) => name), ["register", "commit", "attach"]);
  assert.equal(result.assetId, "asset-1");
  assert.equal(result.fitMode, "TRIM");
  assert.equal(result.trimStartMs, 0);
});

test("editor media validation rejects unsupported and mismatched selections before persistence", () => {
  assert.throws(
    () => validateEditorMediaSelection({ ...imageSelection, kind: "AUDIO" }),
    /ảnh hoặc video/,
  );
  assert.throws(
    () => validateEditorMediaSelection(imageSelection, "VIDEO"),
    /file video/,
  );
  assert.doesNotThrow(() => validateEditorMediaSelection(imageSelection, "IMAGE"));
});

test("editor media import preserves retry data when attach fails after the local asset is committed", async () => {
  const events = [];
  await assert.rejects(
    persistEditorMedia(
      {
        registerLocal: async () => {
          events.push("register");
          return { id: "asset-2", originalFilename: "clip.mp4", durationMs: 9000 };
        },
        commitSelectedAsset: async () => {
          events.push("commit");
        },
        updateBeatMedia: async () => {
          events.push("attach");
          throw new Error("attach unavailable");
        },
      },
      {
        projectId: "project-1",
        beatId: "beat-2",
        beatDurationMs: 6000,
        selection: {
          ...imageSelection,
          kind: "VIDEO",
          originalFilename: "clip.mp4",
          contentType: "video/mp4",
          durationMs: 9000,
        },
      },
    ),
    (error) => {
      assert.ok(error instanceof EditorMediaAttachError);
      assert.equal(error.retryInput.beatId, "beat-2");
      assert.equal(error.retryInput.mediaAssetId, "asset-2");
      assert.equal(error.retryInput.fitMode, "TRIM");
      return true;
    },
  );
  assert.deepEqual(events, ["register", "commit", "attach"]);
});
