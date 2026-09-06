import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  generateGeminiStoryboardImage,
  persistStoryboardImage,
} from "../src/renderer/features/storyboard/queries/storyboard-media.mutations.ts";
import { GeminiReferenceMaterializer } from "../src/renderer/features/storyboard/model/gemini-reference-materializer.ts";
import { runBackgroundRefresh } from "../src/renderer/features/storyboard/model/storyboard-media-refresh.ts";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const INPUT_FP = "c".repeat(64);
const BATCH_FP = "d".repeat(64);

const imageSelection = {
  selectionToken: "selection-1",
  originalFilename: "generated.png",
  contentType: "image/png",
  sizeBytes: 1234,
  checksumSha256: SHA_A,
  kind: "IMAGE",
};

function snapshot(overrides = {}) {
  return {
    snapshotId: "snapshot-1",
    visualBeatId: "beat-1",
    sceneId: "scene-1",
    beatRowVersion: 4,
    prompt: "BACKEND FINAL PROMPT",
    negativePrompt: "",
    characterSnapshotJson: "{}",
    references: [
      {
        refLabel: "REF_01",
        assetId: "asset-a",
        characterId: "char-1",
        canonicalName: "Alice",
        beatRole: "PRIMARY",
        referenceRole: "IDENTITY",
        priority: 1,
        contentType: "image/png",
        sha256: SHA_A,
      },
      {
        refLabel: "REF_02",
        assetId: "asset-b",
        characterId: "char-2",
        canonicalName: "Bob",
        beatRole: "SECONDARY",
        referenceRole: "PROFILE",
        priority: 2,
        contentType: "image/png",
        sha256: SHA_B,
      },
    ],
    continuitySemanticHash: "semantic-1",
    inputFingerprint: INPUT_FP,
    ...overrides,
  };
}

function batch(overrides = {}) {
  const beat = snapshot();
  return {
    batchId: "batch-1",
    chapterId: "chapter-1",
    storyboardRevisionId: "revision-1",
    sourceHash: "e".repeat(64),
    continuityPlanId: "plan-1",
    continuityPlanRevision: 1,
    continuityReportRevision: 1,
    stylePolicyVersion: "storyboard-manhwa-v2",
    providerPolicyVersion: "gemini-web-3.1-pro-cinematic-v1",
    requestFingerprint: BATCH_FP,
    status: "PREPARED",
    stale: false,
    hasBlockingIssues: false,
    issues: [],
    beats: [beat],
    ...overrides,
  };
}

function generationInput(overrides = {}) {
  const prepared = batch();
  return {
    projectId: "project-1",
    chapterId: "chapter-1",
    batch: prepared,
    snapshot: prepared.beats[0],
    attemptId: "attempt-1",
    hasProductionTimelineBeat: false,
    referenceMaterializer: new GeminiReferenceMaterializer(),
    ...overrides,
  };
}

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
});

test("persistStoryboardImage can retain a late output without attaching it", async () => {
  const calls = [];
  const deps = {
    registerLocal: async () => ({ id: "asset-retained" }),
    commitGeminiImage: async () => calls.push("commit"),
    commitSelectedAsset: async () => undefined,
    attachBeatPreview: async () => calls.push("attach-preview"),
    updateBeatMedia: async () => calls.push("attach-timeline"),
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
    attachToBeat: false,
  });

  assert.equal(assetId, "asset-retained");
  assert.deepEqual(calls, ["commit"]);
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
      async () => {
        throw new Error("offline");
      },
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

test("Gemini workflow sends immutable backend prompt and ordered references unchanged", async () => {
  const calls = [];
  const prepared = batch();
  let batchReads = 0;
  const deps = {
    getPreparedBatch: async () => {
      batchReads += 1;
      return prepared;
    },
    materializeRemoteAsset: async (input) => {
      calls.push(["materialize", input]);
      return { checksumSha256: input.assetId === "asset-a" ? SHA_A : SHA_B };
    },
    generateImage: async (input) => {
      calls.push(["generate", input]);
      return {
        ...imageSelection,
        generationAttemptId: "attempt-1",
        generationInputFingerprint: INPUT_FP,
      };
    },
    persistImage: async (input) => {
      calls.push(["persist", input]);
      return "asset-generated";
    },
  };

  const result = await generateGeminiStoryboardImage(deps, generationInput());

  assert.equal(batchReads, 2);
  assert.equal(result.assetId, "asset-generated");
  assert.equal(result.referenceCount, 2);
  assert.deepEqual(calls.map(([name]) => name), [
    "materialize",
    "materialize",
    "generate",
    "persist",
  ]);
  const generated = calls[2][1];
  assert.equal(generated.prompt, "BACKEND FINAL PROMPT");
  assert.deepEqual(generated.references, prepared.beats[0].references);
  assert.deepEqual(generated.provenance, {
    attemptId: "attempt-1",
    batchId: "batch-1",
    snapshotId: "snapshot-1",
    batchFingerprint: BATCH_FP,
    inputFingerprint: INPUT_FP,
    stylePolicyVersion: "storyboard-manhwa-v2",
    providerPolicyVersion: "gemini-web-3.1-pro-cinematic-v1",
  });
  assert.equal(calls[3][1].attachToBeat, true);
});

test("reference materialization checksum mismatch fails before Gemini submit", async () => {
  let submitted = false;
  await assert.rejects(
    () =>
      generateGeminiStoryboardImage(
        {
          getPreparedBatch: async () => batch(),
          materializeRemoteAsset: async () => ({ checksumSha256: "f".repeat(64) }),
          generateImage: async () => {
            submitted = true;
            return imageSelection;
          },
          persistImage: async () => "asset-generated",
        },
        generationInput(),
      ),
    /REFERENCE_INTEGRITY_FAILED/,
  );
  assert.equal(submitted, false);
});

test("blocking prepared batches never dispatch", async () => {
  let submitted = false;
  const blocked = batch({
    hasBlockingIssues: true,
    issues: [
      {
        code: "REFERENCE_BUDGET_EXCEEDED",
        severity: "BLOCKING",
        visualBeatId: "beat-1",
        message: "too many refs",
      },
    ],
  });
  await assert.rejects(
    () =>
      generateGeminiStoryboardImage(
        {
          getPreparedBatch: async () => blocked,
          materializeRemoteAsset: async () => ({ checksumSha256: SHA_A }),
          generateImage: async () => {
            submitted = true;
            return imageSelection;
          },
          persistImage: async () => "asset-generated",
        },
        generationInput({ batch: blocked, snapshot: blocked.beats[0] }),
      ),
    /GENERATION_INPUT_BLOCKED.*REFERENCE_BUDGET_EXCEEDED/,
  );
  assert.equal(submitted, false);
});

test("stale prepared batches never dispatch", async () => {
  let submitted = false;
  const stale = batch({ stale: true });
  await assert.rejects(
    () =>
      generateGeminiStoryboardImage(
        {
          getPreparedBatch: async () => stale,
          materializeRemoteAsset: async () => ({ checksumSha256: SHA_A }),
          generateImage: async () => {
            submitted = true;
            return imageSelection;
          },
          persistImage: async () => "asset-generated",
        },
        generationInput({ batch: stale, snapshot: stale.beats[0] }),
      ),
    /STALE_GENERATION_INPUT/,
  );
  assert.equal(submitted, false);
});

test("late output after source/canon change is retained but not attached", async () => {
  const initial = batch();
  const stale = batch({ stale: true });
  let readCount = 0;
  let persistedInput = null;
  const deps = {
    getPreparedBatch: async () => (++readCount === 1 ? initial : stale),
    materializeRemoteAsset: async (input) => ({
      checksumSha256: input.assetId === "asset-a" ? SHA_A : SHA_B,
    }),
    generateImage: async () => ({
      ...imageSelection,
      generationAttemptId: "attempt-1",
      generationInputFingerprint: INPUT_FP,
    }),
    persistImage: async (input) => {
      persistedInput = input;
      return "asset-late";
    },
  };

  await assert.rejects(
    () => generateGeminiStoryboardImage(deps, generationInput()),
    /STALE_GENERATION_INPUT_OUTPUT_RETAINED.*asset-late/,
  );
  assert.equal(persistedInput.attachToBeat, false);
});

test("Gemini output provenance mismatch is rejected before persistence", async () => {
  let persisted = false;
  await assert.rejects(
    () =>
      generateGeminiStoryboardImage(
        {
          getPreparedBatch: async () => batch(),
          materializeRemoteAsset: async (input) => ({
            checksumSha256: input.assetId === "asset-a" ? SHA_A : SHA_B,
          }),
          generateImage: async () => ({
            ...imageSelection,
            generationAttemptId: "another-attempt",
            generationInputFingerprint: INPUT_FP,
          }),
          persistImage: async () => {
            persisted = true;
            return "asset-generated";
          },
        },
        generationInput(),
      ),
    /GEMINI_OUTPUT_PROVENANCE_MISMATCH/,
  );
  assert.equal(persisted, false);
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
