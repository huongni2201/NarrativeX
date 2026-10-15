import test from "node:test";
import assert from "node:assert/strict";
import { isActiveRenderJob, isTerminalRenderJob } from "../src/renderer/features/production/render-job-state.ts";

test("failed and canceled renders are terminal and may be retried", () => {
  for (const status of ["FAILED", "CANCELED", "COMPLETED"]) {
    assert.equal(isTerminalRenderJob(status), true);
    assert.equal(isActiveRenderJob(status), false);
  }
});

test("ambiguous render jobs remain active until reconciliation", () => {
  for (const status of ["QUEUED", "RUNNING", "UNKNOWN", "STALLED"]) {
    assert.equal(isActiveRenderJob(status), true);
    assert.equal(isTerminalRenderJob(status), false);
  }
});
