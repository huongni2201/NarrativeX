import assert from "node:assert/strict";
import test from "node:test";
import {
  chapterAnalysisQueryKeys,
  chapterAnalysisShouldPoll,
} from "../src/renderer/features/chapters/model/chapter-analysis-query-contract.ts";

test("chapter analysis query keys stay scoped to project chapter and generation job", () => {
  assert.deepEqual(
    chapterAnalysisQueryKeys.workspace("project-1", "chapter-1"),
    ["projects", "project-1", "chapters", "chapter-1", "workspace"],
  );
  assert.deepEqual(
    chapterAnalysisQueryKeys.timeline("project-1"),
    ["projects", "project-1", "timeline"],
  );
  assert.deepEqual(
    chapterAnalysisQueryKeys.job("job-1"),
    ["generation", "generation-job", "job-1"],
  );
});

test("chapter analysis reuses generation polling vocabulary", () => {
  for (const status of ["QUEUED", "RUNNING", "UNKNOWN", "STALLED", "PAUSED_COST_LIMIT"]) {
    assert.equal(chapterAnalysisShouldPoll(status), true, status);
  }
  for (const status of ["COMPLETED", "FAILED", "CANCELED"]) {
    assert.equal(chapterAnalysisShouldPoll(status), false, status);
  }
});
