import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiSource = await readFile(new URL("../src/types/api.ts", import.meta.url), "utf8");
const chapterStateSource = await readFile(
  new URL("../src/features/chapters/hooks/useChapterWorkspaceState.ts", import.meta.url),
  "utf8",
);
const historyScreenSource = await readFile(
  new URL("../src/features/history/JobHistoryScreen.tsx", import.meta.url),
  "utf8",
);

const backendStatuses = [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "UNKNOWN",
  "STALLED",
  "PAUSED_COST_LIMIT",
];

test("frontend JobStatus contract matches backend spelling and states", () => {
  for (const status of backendStatuses) {
    assert.match(apiSource, new RegExp(`\\"${status}\\"`));
  }
  assert.doesNotMatch(apiSource, /CANCELLED/);
  assert.match(apiSource, /TERMINAL_JOB_STATUSES[\s\S]*"CANCELED"/);
  assert.match(apiSource, /ACTIVE_JOB_STATUSES[\s\S]*"PAUSED_COST_LIMIT"/);
});

test("Chapter workspace hook stops polling terminal jobs", () => {
  assert.match(
    chapterStateSource,
    /TERMINAL_JOB_STATUSES\.has\(status\)\s*\?\s*false\s*:\s*1500/,
  );
});

test("Chapter workspace hook derives active UI state from typed active statuses", () => {
  assert.match(chapterStateSource, /ACTIVE_JOB_STATUSES\.has\(\s*analysisJob\.status\s*\)/);
});

test("Job history uses the shared active-status contract for filtering and metrics", () => {
  assert.match(historyScreenSource, /ACTIVE_JOB_STATUSES/);
  assert.match(historyScreenSource, /ACTIVE_JOB_STATUSES\.has\(status as JobStatus\)/);
  assert.doesNotMatch(historyScreenSource, /\[\s*"QUEUED",\s*"RUNNING"\s*\]/);
});
