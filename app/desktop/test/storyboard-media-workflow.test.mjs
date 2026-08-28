import test from "node:test";
import assert from "node:assert/strict";
import {
  generateGeminiStoryboardImage,
  persistStoryboardImage,
} from "../src/renderer/features/storyboard/queries/storyboard-media.mutations.ts";

const imageSelection = {
  selectionToken: "selection-1",
  originalFilename: "generated.png",
  contentType: "image/png",
  sizeBytes: 1234,
  checksumSha256: "abc123",
  kind: "IMAGE",
};

test("persistStoryboardImage keeps register -> trusted commit -> beat selection ordering", async () => {
  const calls = [];
  const deps = {
    registerLocal: async (input) => {
      calls.push(["register", input]);
      return { id: "asset-1" };
    },
    commitGeminiImage: async (input) => calls.push(["commit-gemini", input]),
    commitSelectedAsset: async (input) => calls.push(["commit-manual", input]),
    updateBeatMedia: async (...args) => calls.push(["attach", ...args]),
  };

  const assetId = await persistStoryboardImage(deps, {
    projectId: "project-1",
    beatId: "beat-1",
    selection: imageSelection,
    source: "GEMINI_WEB",
  });

  assert.equal(assetId, "asset-1");
  assert.deepEqual(calls.map(([name]) => name), ["register", "commit-gemini", "attach"]);
  assert.deepEqual(calls[0][1], {
    projectId: "project-1",
    type: "IMAGE",
    originalFilename: "generated.png",
    contentType: "image/png",
    sizeBytes: 1234,
    checksumSha256: "abc123",
    durationMs: null,
  });
  assert.deepEqual(calls[1][1], {
    projectId: "project-1",
    assetId: "asset-1",
    selectionToken: "selection-1",
  });
  assert.deepEqual(calls[2].slice(1), [
    "project-1",
    "beat-1",
    { mediaAssetId: "asset-1", fitMode: "TRIM", trimStartMs: 0 },
  ]);
});

test("manual image persistence uses ProjectStorage commit instead of Gemini commit", async () => {
  const calls = [];
  const deps = {
    registerLocal: async () => ({ id: "asset-2" }),
    commitGeminiImage: async () => calls.push("gemini"),
    commitSelectedAsset: async (input) => calls.push(input),
    updateBeatMedia: async () => undefined,
  };

  await persistStoryboardImage(deps, {
    projectId: "project-1",
    beatId: "beat-2",
    selection: imageSelection,
    source: "MANUAL",
  });

  assert.deepEqual(calls, [
    {
      projectId: "project-1",
      assetId: "asset-2",
      kind: "IMAGE",
      selectionToken: "selection-1",
    },
  ]);
});

test("Gemini workflow sends backend final prompt unchanged and preserves REF mapping", async () => {
  const calls = [];
  const materialized = new Set(["asset-existing"]);
  const context = {
    visualBeatId: "beat-1",
    prompt: "BACKEND FINAL PROMPT",
    references: [
      {
        refLabel: "REF_01",
        assetId: "asset-existing",
        characterId: "char-1",
        canonicalName: "Alice",
        beatRole: "PRIMARY",
        referenceRole: null,
        priority: 1,
        contentType: "image/png",
        sha256: "one",
      },
      {
        refLabel: "REF_02",
        assetId: "asset-new",
        characterId: "char-2",
        canonicalName: "Bob",
        beatRole: "SECONDARY",
        referenceRole: null,
        priority: 2,
        contentType: "image/png",
        sha256: "two",
      },
    ],
  };
  const deps = {
    getGeminiContext: async () => context,
    materializeRemoteAsset: async (input) => calls.push(["materialize", input]),
    generateImage: async (input) => {
      calls.push(["generate", input]);
      return imageSelection;
    },
    persistImage: async (input) => {
      calls.push(["persist", input]);
      return "asset-generated";
    },
  };

  const result = await generateGeminiStoryboardImage(deps, {
    projectId: "project-1",
    chapterId: "chapter-1",
    beat: { id: "beat-1" },
    materializedReferenceIds: materialized,
  });

  assert.equal(result.assetId, "asset-generated");
  assert.equal(result.referenceCount, 2);
  assert.equal(materialized.has("asset-new"), true);
  assert.deepEqual(calls.map(([name]) => name), ["materialize", "generate", "persist"]);
  assert.equal(calls[1][1].prompt, "BACKEND FINAL PROMPT");
  assert.deepEqual(calls[1][1].references, [
    {
      refLabel: "REF_01",
      assetId: "asset-existing",
      characterId: "char-1",
      canonicalName: "Alice",
      beatRole: "PRIMARY",
    },
    {
      refLabel: "REF_02",
      assetId: "asset-new",
      characterId: "char-2",
      canonicalName: "Bob",
      beatRole: "SECONDARY",
    },
  ]);
});

test("Gemini workflow rejects an empty backend prompt", async () => {
  await assert.rejects(
    () =>
      generateGeminiStoryboardImage(
        {
          getGeminiContext: async () => ({ prompt: "   ", references: [] }),
          materializeRemoteAsset: async () => undefined,
          generateImage: async () => imageSelection,
          persistImage: async () => "asset-generated",
        },
        {
          projectId: "project-1",
          chapterId: "chapter-1",
          beat: { id: "beat-1" },
          materializedReferenceIds: new Set(),
        },
      ),
    /Backend chưa trả Gemini prompt/i,
  );
});

test("media workflow rejects non-image selections before registration", async () => {
  let registered = false;
  const deps = {
    registerLocal: async () => {
      registered = true;
      return { id: "asset-1" };
    },
    commitGeminiImage: async () => undefined,
    commitSelectedAsset: async () => undefined,
    updateBeatMedia: async () => undefined,
  };

  await assert.rejects(
    () =>
      persistStoryboardImage(deps, {
        projectId: "project-1",
        beatId: "beat-1",
        selection: { ...imageSelection, kind: "VIDEO" },
        source: "MANUAL",
      }),
    /chỉ chấp nhận file ảnh/i,
  );
  assert.equal(registered, false);
});
