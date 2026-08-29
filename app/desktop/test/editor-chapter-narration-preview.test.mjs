import assert from "node:assert/strict";
import test from "node:test";

test("chapter narration is materialized before Editor exposes its local preview URL", async () => {
  const module = await import(
    "../src/renderer/features/editor/model/chapter-narration-preview.ts"
  ).catch(() => null);
  assert.ok(module, "chapter narration preview materialization must be implemented");

  const materialized = [];
  const url = await module.materializeChapterNarrationPreview(
    {
      materializeChapterNarration: async (input) => {
        materialized.push(input);
      },
    },
    {
      projectId: "00000000-0000-4000-8000-000000000001",
      chapterId: "00000000-0000-4000-8000-000000000003",
      assetId: "00000000-0000-4000-8000-000000000002",
      sizeBytes: 1234,
      checksumSha256: "a".repeat(64),
    },
  );

  assert.deepEqual(materialized, [
    {
      projectId: "00000000-0000-4000-8000-000000000001",
      chapterId: "00000000-0000-4000-8000-000000000003",
      assetId: "00000000-0000-4000-8000-000000000002",
      sizeBytes: 1234,
      checksumSha256: "a".repeat(64),
    },
  ]);
  assert.equal(
    url,
    "narrativex-media://asset/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002",
  );
});

test("chapter narration without an asset does not start materialization", async () => {
  const module = await import(
    "../src/renderer/features/editor/model/chapter-narration-preview.ts"
  ).catch(() => null);
  assert.ok(module, "chapter narration preview materialization must be implemented");

  let calls = 0;
  const url = await module.materializeChapterNarrationPreview(
    {
      materializeChapterNarration: async () => {
        calls += 1;
      },
    },
    {
      projectId: "00000000-0000-4000-8000-000000000001",
      chapterId: "00000000-0000-4000-8000-000000000003",
      assetId: null,
      sizeBytes: null,
      checksumSha256: null,
    },
  );

  assert.equal(calls, 0);
  assert.equal(url, null);
});
