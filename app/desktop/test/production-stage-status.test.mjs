import assert from "node:assert/strict";
import test from "node:test";
import { productionStageStatus } from "../src/renderer/features/chapters/model/production-stage-status.ts";

test("missing authoritative status cannot unlock production or editor", () => {
  assert.deepEqual(productionStageStatus(null), { audioReady: null, totalShots: 0, shotsGeneratedCount: 0, qcPassedCount: 0, editorReady: false, generationReady: false, overallProgressPercent: 0, voiceReady: null });
  const status = productionStageStatus({ audioReady: false, voiceReady: false, totalShots: 3, passedShots: 3, selectedTakeCount: 3, generationReady: true, timelineReady: false, overallProgressPercent: 100 });
  assert.equal(status.editorReady, false);
  assert.equal(status.shotsGeneratedCount, 3);
  assert.equal(status.generationReady, true);
  assert.equal(status.audioReady, false);
  assert.equal(status.voiceReady, false);
});
