import assert from "node:assert/strict";
import test from "node:test";
import {
  UNMEASURED_CHECKS,
  describeQualityWarning,
  qualityMeasurementRows,
  shotQualitySummary,
  suggestedSourceInMs,
  takeQualityBadge,
} from "../src/renderer/features/production/model/take-quality.ts";

const warning = (code, measured, threshold, severity = "REVIEW") => ({
  code,
  category: "MOTION",
  severity,
  measured,
  threshold,
});

const quality = (level, warnings = [], metrics = null) => ({
  level,
  thresholdsVersion: "TAKE_QC_THRESHOLDS_V1",
  warnings,
  metrics,
});

test("badge separates the four automatic QC levels from technical validation", () => {
  assert.deepEqual(takeQualityBadge(quality("GOOD")), { label: "Tốt", tone: "success" });
  assert.deepEqual(takeQualityBadge(quality("REVIEW")), { label: "Cần xem", tone: "warning" });
  assert.deepEqual(takeQualityBadge(quality("DEFECT")), { label: "Có lỗi", tone: "destructive" });
  assert.deepEqual(takeQualityBadge(quality("UNMEASURED")), { label: "Chưa đo", tone: "muted" });
});

test("a take without a quality block, or with an unknown level, reads as not measured", () => {
  assert.deepEqual(takeQualityBadge(undefined), { label: "Chưa đo", tone: "muted" });
  assert.deepEqual(takeQualityBadge(null), { label: "Chưa đo", tone: "muted" });
  assert.deepEqual(takeQualityBadge({ level: "SOMETHING_NEW", warnings: [] }), {
    label: "Chưa đo",
    tone: "muted",
  });
});

test("warnings explain the measured value against the threshold in Vietnamese", () => {
  assert.equal(
    describeQualityWarning(warning("FREEZE_HEAD", 900, 500)).detail,
    "Đứng hình ở đầu clip 0,9 s (ngưỡng 0,5 s).",
  );
  assert.equal(
    describeQualityWarning(warning("FREEZE_TOTAL", 1500, 1250, "DEFECT")).detail,
    "Tổng thời gian đứng hình 1,5 s, quá 25% thời lượng clip (ngưỡng 1,3 s).",
  );
  assert.equal(
    describeQualityWarning(warning("BLACK_FRAMES", 350, 200, "DEFECT")).detail,
    "Có khung đen 0,4 s (ngưỡng 0,2 s).",
  );
  assert.equal(
    describeQualityWarning(warning("HARD_CUT", 2, 1, "DEFECT")).detail,
    "Phát hiện 2 lần cắt cứng trong clip.",
  );
  assert.equal(
    describeQualityWarning(warning("SILENT_DIALOGUE", 4000, 3000, "DEFECT")).detail,
    "Shot có thoại nhưng im lặng 4,0 s (ngưỡng 3,0 s).",
  );
  assert.equal(
    describeQualityWarning(warning("AUDIO_TOO_QUIET", -36, -35)).detail,
    "Âm lượng quá nhỏ: -36,0 LUFS (ngưỡng -35,0 LUFS).",
  );
});

test("an unknown warning code still renders its raw numbers instead of disappearing", () => {
  const described = describeQualityWarning(warning("BRAND_NEW_CHECK", 3, 2));
  assert.equal(described.title, "BRAND_NEW_CHECK");
  assert.match(described.detail, /3/);
  assert.match(described.detail, /2/);
});

test("measurement rows list only values that were measured", () => {
  const rows = qualityMeasurementRows({
    status: "MEASURED",
    scorerVersion: "FFMPEG_TAKE_QC_V1",
    freezeHeadMs: 417,
    freezeTotalMs: 583,
    motionMean: 2.84,
    sceneCutCount: 0,
    silenceTotalMs: null,
    integratedLufs: -19.4,
  });
  const byLabel = Object.fromEntries(rows.map((row) => [row.label, row.value]));
  assert.equal(byLabel["Đứng hình đầu clip"], "0,4 s");
  assert.equal(byLabel["Tổng đứng hình"], "0,6 s");
  assert.equal(byLabel["Cắt cứng trong clip"], "0");
  assert.equal(byLabel["Độ lớn tiếng"], "-19,4 LUFS");
  assert.equal("Im lặng" in byLabel, false);
});

test("an unavailable measurement exposes no rows", () => {
  assert.deepEqual(
    qualityMeasurementRows({ status: "UNAVAILABLE", scorerVersion: "FFMPEG_TAKE_QC_V1", reason: "timed out" }),
    [],
  );
  assert.deepEqual(qualityMeasurementRows(null), []);
});

test("checks the first QC tier does not perform are named as not measured", () => {
  assert.deepEqual(UNMEASURED_CHECKS, [
    "Giống mặt nhân vật",
    "Khớp khẩu hình (lip-sync)",
    "Biến dạng tay/mặt",
  ]);
});

test("trim suggestion skips a frozen opening only when it was flagged and leaves a usable clip", () => {
  const flagged = quality("REVIEW", [warning("FREEZE_HEAD", 900, 500)], { status: "MEASURED", freezeHeadMs: 900 });
  assert.equal(suggestedSourceInMs(flagged, 5000), 900);
  assert.equal(suggestedSourceInMs(flagged, 950), null, "would leave under 100 ms");
  const notFlagged = quality("GOOD", [], { status: "MEASURED", freezeHeadMs: 300 });
  assert.equal(suggestedSourceInMs(notFlagged, 5000), null);
  assert.equal(suggestedSourceInMs(null, 5000), null);
});

test("shot summary reports the selected take, defect count and whether anything needs a look", () => {
  const takes = [
    { id: "a", quality: quality("DEFECT", [warning("HARD_CUT", 1, 1, "DEFECT")]) },
    { id: "b", quality: quality("GOOD") },
    { id: "c", quality: quality("REVIEW", [warning("FLICKER", 9, 8)]) },
    { id: "d" },
  ];
  assert.deepEqual(shotQualitySummary(takes, "b"), {
    selectedLevel: "GOOD",
    defectTakeCount: 1,
    needsAttention: true,
  });
  assert.deepEqual(shotQualitySummary(takes, "a"), {
    selectedLevel: "DEFECT",
    defectTakeCount: 1,
    needsAttention: true,
  });
});

test("shot summary: nothing selected or measured raises no alarm", () => {
  assert.deepEqual(shotQualitySummary([{ id: "x" }], null), {
    selectedLevel: null,
    defectTakeCount: 0,
    needsAttention: false,
  });
  assert.deepEqual(shotQualitySummary([], "x"), {
    selectedLevel: null,
    defectTakeCount: 0,
    needsAttention: false,
  });
  assert.equal(
    shotQualitySummary([{ id: "x", quality: quality("GOOD") }], "x").needsAttention,
    false,
  );
});
