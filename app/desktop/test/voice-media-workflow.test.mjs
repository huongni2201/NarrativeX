import assert from "node:assert/strict";
import test from "node:test";
import { persistVoiceAudioAsset } from "../src/renderer/features/voices/queries/voice-media.mutations.ts";

const selection = {
  selectionToken: "selection-1",
  originalFilename: "chapter.wav",
  contentType: "audio/wav",
  sizeBytes: 1024,
  checksumSha256: "abc123",
  kind: "AUDIO",
  durationMs: 12_000,
};

test("voice audio import registers metadata before committing the trusted selection", async () => {
  const calls = [];
  const result = await persistVoiceAudioAsset(
    {
      registerLocal: async (input) => {
        calls.push(["register", input]);
        return { id: "asset-1" };
      },
      commitSelectedAsset: async (input) => {
        calls.push(["commit", input]);
        return { assetId: input.assetId };
      },
    },
    { projectId: "project-1", selection },
  );

  assert.equal(result.assetId, "asset-1");
  assert.deepEqual(calls.map(([name]) => name), ["register", "commit"]);
  assert.deepEqual(calls[0][1], {
    projectId: "project-1",
    type: "AUDIO",
    originalFilename: "chapter.wav",
    contentType: "audio/wav",
    sizeBytes: 1024,
    checksumSha256: "abc123",
    durationMs: 12_000,
  });
  assert.deepEqual(calls[1][1], {
    projectId: "project-1",
    assetId: "asset-1",
    kind: "AUDIO",
    selectionToken: "selection-1",
  });
});

test("voice audio import rejects non-audio selections and files over 50 MiB", async () => {
  const deps = {
    registerLocal: async () => ({ id: "unexpected" }),
    commitSelectedAsset: async () => ({}),
  };

  await assert.rejects(
    () => persistVoiceAudioAsset(deps, { projectId: "project-1", selection: { ...selection, kind: "IMAGE" } }),
    /Chỉ hỗ trợ file audio/,
  );
  await assert.rejects(
    () => persistVoiceAudioAsset(deps, { projectId: "project-1", selection: { ...selection, sizeBytes: 50 * 1024 * 1024 + 1 } }),
    /50MB/,
  );
});
