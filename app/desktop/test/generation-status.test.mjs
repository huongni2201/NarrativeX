import test from "node:test";
import assert from "node:assert/strict";
import {
  isActiveGenerationJobStatus,
  isActiveMediaExecutionStatus,
  isTerminalGenerationJobStatus,
} from "../src/renderer/features/generation/generation-status.ts";

test("generation polling includes every backend active state", () => {
  for (const status of ["QUEUED", "RUNNING", "UNKNOWN", "STALLED", "PAUSED_COST_LIMIT"]) {
    assert.equal(isActiveGenerationJobStatus(status), true, status);
  }
  for (const status of ["COMPLETED", "FAILED", "CANCELED"]) {
    assert.equal(isActiveGenerationJobStatus(status), false, status);
    assert.equal(isTerminalGenerationJobStatus(status), true, status);
  }
});

test("media item polling continues through validation and reconciliation", () => {
  for (const status of ["QUEUED", "RUNNING", "VALIDATING", "UNKNOWN"]) {
    assert.equal(isActiveMediaExecutionStatus(status), true, status);
  }
  for (const status of ["READY", "FAILED"]) {
    assert.equal(isActiveMediaExecutionStatus(status), false, status);
  }
});
