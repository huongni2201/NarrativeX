import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  generateGeminiStoryboardImage,
  persistStoryboardImage,
} from "../src/renderer/features/storyboard/queries/storyboard-media.mutations.ts";
import { runBackgroundRefresh } from "../src/renderer/features/storyboard/model/storyboard-media-refresh.ts";

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
    attachBeatPreview: async (...args) => calls.push(["attach-preview", ...args]),
    updateBeatMedia: async (...args) => calls.push(["attach", ...args]),
  };

  const assetId = await persistStoryboardImage(deps, {
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    beatId: "beat-1",
    beatRowVersion: 2,
    hasProductionTimelineBeat: true,
    selection: imageSelection,
    source: "GEMINI_WEB",
  });

  assert.equal(assetId, "asset-1");
  assert.deepEqual(calls.map(([name]) => name), [
    "register",
    "commit-gemini",
    "attach-preview",
    "attach",
  ]);
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
    lane: "STORYBOARD",
    projectId: "project-1",
    assetId: "asset-1",
    selectionToken: "selection-1",
  });
  assert.deepEqual(calls[2].slice(1), [
    "project-1",
    "chapter-1",
    "scene-1",
    "beat-1",
    2,
    "asset-1",
  ]);
  assert.deepEqual(calls[3].slice(1), [
    "project-1",
    "beat-1",
    { mediaAssetId: "asset-1", fitMode: "TRIM", trimStartMs: 0 },
  ]);
});

test("Storyboard cache refresh is handled in the background", () => {
  const source = readFileSync(
    "src/renderer/features/storyboard/queries/storyboard-media.queries.ts",
    "utf8",
  );
  assert.match(source, /export function refreshStoryboardMediaInBackground/);
  assert.doesNotMatch(source, /onSettled:\s*async/);
});

test("a rejected cache refresh cannot reject the caller", async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    runBackgroundRefresh(
      async () => { throw new Error("offline"); },
      (error) => warnings.push(["refresh", { error }]),
    );
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], "refresh");
});

test("manual image persistence uses ProjectStorage commit instead of Gemini commit", async () => {
  const calls = [];
  const deps = {
    registerLocal: async () => ({ id: "asset-2" }),
    commitGeminiImage: async () => calls.push("gemini"),
    commitSelectedAsset: async (input) => calls.push(input),
    attachBeatPreview: async () => undefined,
    updateBeatMedia: async () => undefined,
  };

  await persistStoryboardImage(deps, {
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    beatId: "beat-2",
    beatRowVersion: 0,
    hasProductionTimelineBeat: true,
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

test("storyboard image persists its preview when the beat has no production timeline entry", async () => {
  const calls = [];
  const deps = {
    registerLocal: async () => ({ id: "asset-preview" }),
    commitGeminiImage: async () => calls.push("commit-gemini"),
    commitSelectedAsset: async () => calls.push("commit-manual"),
    attachBeatPreview: async (...args) => calls.push(["attach-preview", ...args]),
    updateBeatMedia: async () => {
      throw new Error("production timeline must not be required for a storyboard preview");
    },
  };

  const assetId = await persistStoryboardImage(deps, {
    projectId: "project-1",
    chapterId: "chapter-1",
    sceneId: "scene-1",
    beatId: "beat-without-timing",
    beatRowVersion: 3,
    hasProductionTimelineBeat: false,
    selection: imageSelection,
    source: "GEMINI_WEB",
  });

  assert.equal(assetId, "asset-preview");
  assert.deepEqual(calls, [
    "commit-gemini",
    [
      "attach-preview",
      "project-1",
      "chapter-1",
      "scene-1",
      "beat-without-timing",
      3,
      "asset-preview",
    ],
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
    beat: { id: "beat-1", sceneId: "scene-1", rowVersion: 4 },
    hasProductionTimelineBeat: false,
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
          beat: { id: "beat-1", sceneId: "scene-1", rowVersion: 0 },
          hasProductionTimelineBeat: false,
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
    attachBeatPreview: async () => undefined,
    updateBeatMedia: async () => undefined,
  };

  await assert.rejects(
    () =>
      persistStoryboardImage(deps, {
        projectId: "project-1",
        chapterId: "chapter-1",
        sceneId: "scene-1",
        beatId: "beat-1",
        beatRowVersion: 0,
        hasProductionTimelineBeat: false,
        selection: { ...imageSelection, kind: "VIDEO" },
        source: "MANUAL",
      }),
    /chỉ chấp nhận file ảnh/i,
  );
  assert.equal(registered, false);
});
