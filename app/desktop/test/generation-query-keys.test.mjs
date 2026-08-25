import test from "node:test";
import assert from "node:assert/strict";
import { generationQueryKeys } from "../src/renderer/features/generation/queries/generation.queries.ts";

test("generation job and media job caches use distinct keys", () => {
  const jobId = "job-1";

  assert.notDeepEqual(
    generationQueryKeys.generationJob(jobId),
    generationQueryKeys.mediaJob(jobId),
  );
  assert.deepEqual(generationQueryKeys.generationJob(jobId), [
    "generation",
    "generation-job",
    jobId,
  ]);
  assert.deepEqual(generationQueryKeys.mediaJob(jobId), [
    "generation",
    "media-job",
    jobId,
  ]);
});
