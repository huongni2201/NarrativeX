import assert from "node:assert/strict";
import test from "node:test";
import { deriveChapterAnalysisUiState } from "../src/renderer/features/chapters/model/chapter-analysis.ts";

function job(status, errorCode = null) {
  return { status, errorCode };
}

test("chapter analysis state is idle and analyzable without a tracked job", () => {
  assert.deepEqual(deriveChapterAnalysisUiState(null, false), {
    isAnalyzing: false,
    isTerminal: false,
    canAnalyze: true,
    message: null,
  });
});

test("chapter analysis state disables duplicate requests while mutation or job is active", () => {
  const pending = deriveChapterAnalysisUiState(null, true);
  assert.equal(pending.isAnalyzing, true);
  assert.equal(pending.canAnalyze, false);

  for (const status of ["QUEUED", "RUNNING", "UNKNOWN", "STALLED", "PAUSED_COST_LIMIT"]) {
    const state = deriveChapterAnalysisUiState(job(status), false);
    assert.equal(state.isAnalyzing, true, status);
    assert.equal(state.isTerminal, false, status);
    assert.equal(state.canAnalyze, false, status);
  }
});

test("chapter analysis state exposes completed, failed and cancelled terminal outcomes", () => {
  const completed = deriveChapterAnalysisUiState(job("COMPLETED"), false);
  assert.equal(completed.isAnalyzing, false);
  assert.equal(completed.isTerminal, true);
  assert.equal(completed.canAnalyze, true);
  assert.match(completed.message, /hoàn tất/i);

  const failed = deriveChapterAnalysisUiState(job("FAILED", "MODEL_TIMEOUT"), false);
  assert.equal(failed.isTerminal, true);
  assert.equal(failed.canAnalyze, true);
  assert.match(failed.message, /MODEL_TIMEOUT/);

  const cancelled = deriveChapterAnalysisUiState(job("CANCELED"), false);
  assert.equal(cancelled.isTerminal, true);
  assert.equal(cancelled.canAnalyze, true);
  assert.match(cancelled.message, /hủy/i);
});
