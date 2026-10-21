import type {
  TakeQuality,
  TakeQualityLevel,
  TakeQualityMetrics,
  TakeQualityWarning,
} from "../../../../shared/api-types";

export type TakeQualityTone = "success" | "warning" | "destructive" | "muted";

const BADGES: Record<TakeQualityLevel, { label: string; tone: TakeQualityTone }> = {
  GOOD: { label: "Tốt", tone: "success" },
  REVIEW: { label: "Cần xem", tone: "warning" },
  DEFECT: { label: "Có lỗi", tone: "destructive" },
  UNMEASURED: { label: "Chưa đo", tone: "muted" },
};

/** What the first QC tier cannot see yet; shown as "chưa đo" so silence is not read as a pass. */
export const UNMEASURED_CHECKS = [
  "Giống mặt nhân vật",
  "Khớp khẩu hình (lip-sync)",
  "Biến dạng tay/mặt",
] as const;

/** An unknown or missing level reads as "not measured", never as good. */
export function takeQualityBadge(quality?: { level?: string } | null): {
  label: string;
  tone: TakeQualityTone;
} {
  const level = quality?.level as TakeQualityLevel | undefined;
  return (level && BADGES[level]) || BADGES.UNMEASURED;
}

const decimal = (value: number, digits: number) => value.toFixed(digits).replace(".", ",");
// Round to tenths from whole milliseconds so 350 ms reads 0,4 s on every engine.
const seconds = (ms: number) => `${decimal(Math.round(ms / 100) / 10, 1)} s`;
const lufs = (value: number) => `${decimal(value, 1)} LUFS`;

const WARNINGS: Record<string, { title: string; detail: (w: TakeQualityWarning) => string }> = {
  FREEZE_HEAD: {
    title: "Đứng hình đầu clip",
    detail: (w) =>
      `Đứng hình ở đầu clip ${seconds(w.measured)} (ngưỡng ${seconds(w.threshold)}).`,
  },
  FREEZE_TAIL: {
    title: "Đứng hình cuối clip",
    detail: (w) =>
      `Đứng hình ở cuối clip ${seconds(w.measured)} (ngưỡng ${seconds(w.threshold)}).`,
  },
  FREEZE_TOTAL: {
    title: "Đứng hình nhiều",
    detail: (w) =>
      `Tổng thời gian đứng hình ${seconds(w.measured)}, quá 25% thời lượng clip (ngưỡng ${seconds(w.threshold)}).`,
  },
  LOW_MOTION: {
    title: "Chuyển động thấp",
    detail: (w) =>
      `Chuyển động trung bình ${decimal(w.measured, 2)} (ngưỡng ${decimal(w.threshold, 2)}).`,
  },
  HARD_CUT: {
    title: "Cắt cứng trong clip",
    detail: (w) => `Phát hiện ${w.measured} lần cắt cứng trong clip.`,
  },
  FLICKER: {
    title: "Nhấp nháy độ sáng",
    detail: (w) =>
      `Độ sáng dao động ${decimal(w.measured, 1)} (ngưỡng ${decimal(w.threshold, 1)}).`,
  },
  BLACK_FRAMES: {
    title: "Khung đen",
    detail: (w) => `Có khung đen ${seconds(w.measured)} (ngưỡng ${seconds(w.threshold)}).`,
  },
  WHITE_FRAMES: {
    title: "Khung trắng",
    detail: (w) => `Có khung trắng ${seconds(w.measured)} (ngưỡng ${seconds(w.threshold)}).`,
  },
  SILENT_DIALOGUE: {
    title: "Im lặng khi có thoại",
    detail: (w) =>
      `Shot có thoại nhưng im lặng ${seconds(w.measured)} (ngưỡng ${seconds(w.threshold)}).`,
  },
  CLIPPING: {
    title: "Tiếng bị vỡ (clipping)",
    detail: (w) => `Đỉnh âm thanh ${decimal(w.measured, 1)} dBFS, chạm mức tối đa.`,
  },
  AUDIO_TOO_QUIET: {
    title: "Tiếng quá nhỏ",
    detail: (w) => `Âm lượng quá nhỏ: ${lufs(w.measured)} (ngưỡng ${lufs(w.threshold)}).`,
  },
  COLOR_DRIFT: {
    title: "Màu lệch so với Scene",
    detail: (w) =>
      `Màu lệch ${decimal(w.measured, 1)} so với các Take đã chọn trong Scene (ngưỡng ${decimal(w.threshold, 1)}).`,
  },
};

export function describeQualityWarning(warning: TakeQualityWarning): {
  title: string;
  detail: string;
} {
  const known = WARNINGS[warning.code];
  if (known) return { title: known.title, detail: known.detail(warning) };
  return {
    title: warning.code,
    detail: `Đo được ${warning.measured}, ngưỡng ${warning.threshold}.`,
  };
}

/** Only values the worker actually measured; an unavailable measurement has none. */
export function qualityMeasurementRows(
  metrics?: TakeQualityMetrics | null,
): Array<{ label: string; value: string }> {
  if (!metrics || metrics.status !== "MEASURED") return [];
  const rows: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: number | null | undefined, format: (n: number) => string) => {
    if (value != null) rows.push({ label, value: format(value) });
  };
  add("Đứng hình đầu clip", metrics.freezeHeadMs, seconds);
  add("Đứng hình cuối clip", metrics.freezeTailMs, seconds);
  add("Tổng đứng hình", metrics.freezeTotalMs, seconds);
  add("Chuyển động trung bình", metrics.motionMean, (n) => decimal(n, 2));
  add("Cắt cứng trong clip", metrics.sceneCutCount, String);
  add("Nhấp nháy (độ lệch sáng)", metrics.flickerStddev, (n) => decimal(n, 2));
  add("Khung đen", metrics.blackTotalMs, seconds);
  add("Khung trắng", metrics.whiteTotalMs, seconds);
  add("Im lặng", metrics.silenceTotalMs, seconds);
  add("Độ lớn tiếng", metrics.integratedLufs, lufs);
  add("Đỉnh âm thanh", metrics.peakDbfs, (n) => `${decimal(n, 1)} dBFS`);
  if (metrics.meanY != null && metrics.meanU != null && metrics.meanV != null) {
    rows.push({
      label: "Màu trung bình (Y/U/V)",
      value: [metrics.meanY, metrics.meanU, metrics.meanV].map((n) => Math.round(n)).join("/"),
    });
  }
  if (metrics.stddevY != null && metrics.stddevU != null && metrics.stddevV != null) {
    rows.push({
      label: "Độ lệch màu trong clip (Y/U/V)",
      value: [metrics.stddevY, metrics.stddevU, metrics.stddevV]
        .map((n) => decimal(n, 1))
        .join("/"),
    });
  }
  if (metrics.lowY != null && metrics.highY != null) {
    rows.push({
      label: "Dải sáng (10%–90%)",
      value: `${Math.round(metrics.lowY)}–${Math.round(metrics.highY)}`,
    });
  }
  return rows;
}

const MIN_USABLE_MS = 100;

/**
 * In point that skips a flagged frozen opening; the editor applies it explicitly. `sourceOutMs`
 * is the current Out so a suggestion never leaves less than a usable span.
 */
export function suggestedSourceInMs(
  quality: TakeQuality | null | undefined,
  durationMs: number,
  sourceOutMs: number = durationMs,
): number | null {
  const flagged = quality?.warnings.some((warning) => warning.code === "FREEZE_HEAD");
  const head = quality?.metrics?.freezeHeadMs;
  if (!flagged || head == null || head <= 0) return null;
  return Math.min(sourceOutMs, durationMs) - head >= MIN_USABLE_MS ? head : null;
}

/** Out point that drops a flagged frozen ending; the editor applies it explicitly. */
export function suggestedSourceOutMs(
  quality: TakeQuality | null | undefined,
  durationMs: number,
  sourceInMs: number = 0,
): number | null {
  const flagged = quality?.warnings.some((warning) => warning.code === "FREEZE_TAIL");
  const tail = quality?.metrics?.freezeTailMs;
  if (!flagged || tail == null || tail <= 0) return null;
  const out = durationMs - tail;
  return out - sourceInMs >= MIN_USABLE_MS ? out : null;
}

/** Said in words so an unknown speech expectation is not read as "no dialogue expected". */
export function speechExpectationNote(quality?: TakeQuality | null): string | null {
  return quality?.level !== "UNMEASURED" && quality?.speechExpectation === "UNKNOWN"
    ? "Không xác định Take này có thoại hay không nên chưa kiểm tra im lặng."
    : null;
}

/**
 * Choosing the take that is already active must not touch the editor's trim or review checklist;
 * only a different take starts a fresh trim.
 */
export function takeSelectionStartsFreshTrim(
  activeTakeId: string | null | undefined,
  selectedTakeId: string,
): boolean {
  return activeTakeId !== selectedTakeId;
}

export interface ShotQualitySummary {
  selectedLevel: TakeQualityLevel | null;
  defectTakeCount: number;
  needsAttention: boolean;
}

export function shotQualitySummary(
  takes: ReadonlyArray<{ id: string; quality?: TakeQuality | null }>,
  selectedTakeId: string | null | undefined,
): ShotQualitySummary {
  const selected = selectedTakeId ? takes.find((take) => take.id === selectedTakeId) : undefined;
  return {
    selectedLevel: selected ? (selected.quality?.level ?? "UNMEASURED") : null,
    defectTakeCount: takes.filter((take) => take.quality?.level === "DEFECT").length,
    needsAttention: takes.some(
      (take) => take.quality?.level === "REVIEW" || take.quality?.level === "DEFECT",
    ),
  };
}
