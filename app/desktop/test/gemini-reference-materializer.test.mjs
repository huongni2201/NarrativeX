import test from "node:test";
import assert from "node:assert/strict";
import { GeminiReferenceMaterializer } from "../src/renderer/features/storyboard/model/gemini-reference-materializer.ts";

const SHA = "a".repeat(64);

test("concurrent reference materialization shares one checksum-bound in-flight operation", async () => {
  const materializer = new GeminiReferenceMaterializer();
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const fetchReference = async () => {
    calls += 1;
    await gate;
    return { checksumSha256: SHA };
  };

  const first = materializer.materialize(
    { projectId: "project-1", assetId: "asset-1", expectedChecksumSha256: SHA },
    fetchReference,
  );
  const second = materializer.materialize(
    { projectId: "project-1", assetId: "asset-1", expectedChecksumSha256: SHA },
    fetchReference,
  );
  assert.equal(calls, 1);
  release();
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});

test("checksum failure clears the in-flight key so a repaired asset can retry", async () => {
  const materializer = new GeminiReferenceMaterializer();
  let calls = 0;
  const input = {
    projectId: "project-1",
    assetId: "asset-1",
    expectedChecksumSha256: SHA,
  };

  await assert.rejects(
    () =>
      materializer.materialize(input, async () => {
        calls += 1;
        return { checksumSha256: "b".repeat(64) };
      }),
    /REFERENCE_INTEGRITY_FAILED/,
  );
  await materializer.materialize(input, async () => {
    calls += 1;
    return { checksumSha256: SHA };
  });
  assert.equal(calls, 2);
});

test("same asset with different expected checksum does not share an integrity lease", async () => {
  const materializer = new GeminiReferenceMaterializer();
  let calls = 0;
  await Promise.all([
    materializer.materialize(
      { projectId: "project-1", assetId: "asset-1", expectedChecksumSha256: SHA },
      async () => {
        calls += 1;
        return { checksumSha256: SHA };
      },
    ),
    materializer.materialize(
      {
        projectId: "project-1",
        assetId: "asset-1",
        expectedChecksumSha256: "b".repeat(64),
      },
      async () => {
        calls += 1;
        return { checksumSha256: "b".repeat(64) };
      },
    ),
  ]);
  assert.equal(calls, 2);
});
