import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hookSource = await readFile(
  new URL("../src/features/render/hooks/useChapterRender.ts", import.meta.url),
  "utf8",
);
const tabSource = await readFile(
  new URL("../src/features/chapters/components/ChapterRenderTab.tsx", import.meta.url),
  "utf8",
);

const renderStates = [
  "IDLE",
  "SUBMITTING",
  "QUEUED",
  "RUNNING",
  "STALLED",
  "COMPLETED",
  "RESOLVING_ARTIFACT",
  "READY",
  "FAILED",
];

test("chapter render hook owns the render state machine and public view model", () => {
  for (const state of renderStates) assert.match(hookSource, new RegExp(`"${state}"`));
  for (const field of ["render", "job", "artifact", "status", "progress", "error", "canRender", "retry"]) {
    assert.match(hookSource, new RegExp(`\\b${field}\\b`));
  }
  assert.match(hookSource, /mediaApi\.render/);
  assert.match(hookSource, /artifactsApi\.getByJobId/);
});

test("chapter render keeps one idempotency key per render intent", () => {
  assert.match(hookSource, /useRef/);
  assert.match(hookSource, /idempotencyKeyRef/);
  assert.doesNotMatch(hookSource, /mediaApi\.render\([^\n]*crypto\.randomUUID\(\)/);
  assert.match(hookSource, /isDefinitiveRenderRequestFailure/);
  assert.match(hookSource, /idempotencyKeyRef\.current = null/);
  assert.match(hookSource, /idempotencyKey: (?:startNewRenderIntent|ensureRenderIntentKey)\(idempotencyKeyRef\)/);
});

test("ChapterRenderTab delegates readiness and submission to the hook", () => {
  assert.match(tabSource, /render\.render\(\)/);
  assert.match(tabSource, /render\.canRender/);
  assert.doesNotMatch(tabSource, /media\.details/);
  assert.doesNotMatch(tabSource, /renderChapter/);
  assert.doesNotMatch(tabSource, /mediaApi\.render/);
});
