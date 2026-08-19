import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiSource = await readFile(new URL("../src/types/api.ts", import.meta.url), "utf8");
const chapterEditorSource = await readFile(
  new URL("../src/features/chapters/components/ChapterEditor.tsx", import.meta.url),
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

test("ChapterEditor stops polling terminal jobs", () => {
  assert.match(chapterEditorSource, /TERMINAL_JOB_STATUSES\.has\(status\)\s*\?\s*false\s*:\s*1500/);
});

test("ChapterEditor derives active UI state from typed active statuses", () => {
  assert.match(chapterEditorSource, /ACTIVE_JOB_STATUSES\.has\(analysisJob\.status\)/);
});
