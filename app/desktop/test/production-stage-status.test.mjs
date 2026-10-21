import assert from "node:assert/strict";
import test from "node:test";
import { productionNextStep, productionStageStatus } from "../src/renderer/features/chapters/model/production-stage-status.ts";
import { whisperXEvidenceStatus } from "../src/renderer/features/production/model/whisperx-status.ts";

test("missing authoritative status cannot unlock production or editor", () => {
  assert.deepEqual(productionStageStatus(null), { audioReady: null, totalShots: 0, shotsGeneratedCount: 0, technicalValidatedCount: 0, editorReady: false, generationReady: false, overallProgressPercent: 0, voiceReady: null });
  const status = productionStageStatus({ audioReady: false, voiceReady: false, totalShots: 3, passedShots: 3, selectedTakeCount: 3, generationReady: true, timelineReady: false, overallProgressPercent: 100 });
  assert.equal(status.editorReady, false);
  assert.equal(status.shotsGeneratedCount, 3);
  assert.equal(status.technicalValidatedCount, 3);
  assert.equal(status.generationReady, true);
  assert.equal(status.audioReady, false);
  assert.equal(status.voiceReady, false);
});

const readyForGeneration = {
  storyReady: true, audioReady: false, voiceReady: true, totalShots: 3,
  queuedShots: 0, generatingShots: 0, validatingShots: 0, passedShots: 0,
  failedShots: 0, blockedShots: 0, manualReviewShots: 0, selectedTakeCount: 0,
  generationReady: true, timelineReady: false, renderReady: false,
};

test("guidance keeps narration separate from native AV generation admission", () => {
  assert.equal(productionNextStep(readyForGeneration).title, "Tạo các Shot còn thiếu");
  assert.equal(productionNextStep({ ...readyForGeneration, passedShots: 3 }).title, "Duyệt và chọn Take cho từng Shot");
  assert.equal(productionNextStep({ ...readyForGeneration, voiceReady: false }).destination, "audio");
});

test("guidance prioritizes running and manual review work over regeneration", () => {
  assert.equal(productionNextStep({ ...readyForGeneration, generatingShots: 1 }).title, "Theo dõi các Shot đang xử lý");
  assert.equal(productionNextStep({ ...readyForGeneration, manualReviewShots: 1 }).title, "Kiểm tra Shot cần duyệt thủ công");
});

test("selected Takes do not unlock readiness or depend on new generation settings", () => {
  const selected = { ...readyForGeneration, selectedTakeCount: 3, passedShots: 3, generationReady: false, voiceReady: false };
  assert.equal(productionNextStep(selected).title, "Kiểm tra dữ liệu dựng chương");
  assert.equal(productionNextStep(selected).destination, "editor");
  assert.equal(productionNextStep({ ...selected, timelineReady: true }).title, "Chương đã sẵn sàng để dựng");
  assert.equal(productionNextStep({ ...selected, timelineReady: true, renderReady: true }).title, "Dự án đã sẵn sàng để xuất video");
  assert.equal(productionNextStep(null).destination, undefined);
});

test("technical PASS and WhisperX timing evidence remain separate", () => {
  assert.equal(whisperXEvidenceStatus(null), "NO_DATA");
  assert.equal(whisperXEvidenceStatus({ status: "PASSED", timingMatch: true }), "PASSED");
  assert.equal(whisperXEvidenceStatus({ status: "WARNING", timingMatch: true }), "WARNING");
  assert.equal(whisperXEvidenceStatus({ status: "FAILED", timingMatch: false }), "FAILED");
  assert.equal(whisperXEvidenceStatus({ status: "PASSED", timingMatch: false }), "FAILED");
});
