import assert from "node:assert/strict";
import test from "node:test";
import { deriveChapterAnalysisUiState } from "../src/renderer/features/chapters/model/chapter-analysis.ts";
import * as chapterUi from "../src/renderer/features/chapters/model/chapter-ui.ts";
import { generationJobPollInterval } from "../src/renderer/features/generation/generation-status.ts";

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

test("chapter analysis state disables duplicates and only spins for confirmed progress", () => {
  const pending = deriveChapterAnalysisUiState(null, true);
  assert.equal(pending.isAnalyzing, true);
  assert.equal(pending.canAnalyze, false);

  for (const status of ["QUEUED", "RUNNING"]) {
    const state = deriveChapterAnalysisUiState(job(status), false);
    assert.equal(state.isAnalyzing, true, status);
    assert.equal(state.isTerminal, false, status);
    assert.equal(state.canAnalyze, false, status);
  }

  for (const status of ["UNKNOWN", "STALLED"]) {
    const state = deriveChapterAnalysisUiState(job(status), false);
    assert.equal(state.isAnalyzing, false, status);
    assert.equal(state.isTerminal, false, status);
    assert.equal(state.canAnalyze, false, status);
  }
  assert.match(deriveChapterAnalysisUiState(job("UNKNOWN"), false).message, /chưa xác định/i);
  assert.match(deriveChapterAnalysisUiState(job("STALLED"), false).message, /đã dừng/i);
});

test("a polling error stops presenting cached RUNNING data as active", () => {
  const state = deriveChapterAnalysisUiState(job("RUNNING"), false, true);

  assert.equal(state.isAnalyzing, false);
  assert.equal(state.isTerminal, false);
  assert.equal(state.canAnalyze, false);
  assert.match(state.message, /không thể xác nhận/i);
});

test("a polling error stops automatic retries even when cached job data is active", () => {
  assert.equal(generationJobPollInterval("error", "RUNNING"), false);
  assert.equal(generationJobPollInterval("success", "RUNNING"), 15_000);
  assert.equal(generationJobPollInterval("pending", undefined), 15_000);
  assert.equal(generationJobPollInterval("success", "FAILED"), false);
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

test("initial chapter creation requires a title and nonblank source text", () => {
  const canCreateInitialChapter = chapterUi.canCreateInitialChapter;
  assert.equal(typeof canCreateInitialChapter, "function");
  assert.equal(canCreateInitialChapter("Chương 1", ""), false);
  assert.equal(canCreateInitialChapter("Chương 1", "  \n  "), false);
  assert.equal(canCreateInitialChapter("  ", "Nội dung chương"), false);
  assert.equal(canCreateInitialChapter("Chương 1", "Nội dung chương"), true);
});
