import { AlertCircle, AlertTriangle, ScanSearch } from "lucide-react";
import type { TakeQuality } from "../../../../shared/api-types";
import { Badge } from "@/components/ui/badge";
import {
  UNMEASURED_CHECKS,
  describeQualityWarning,
  qualityMeasurementRows,
  suggestedSourceInMs,
  takeQualityBadge,
  type TakeQualityTone,
} from "../../production/model/take-quality";

const TONE_CLASS: Record<TakeQualityTone, string> = {
  success: "border-success/30 bg-success-bg text-success",
  warning: "border-warning/30 bg-warning-bg text-warning",
  destructive: "border-danger-border bg-danger-bg text-danger",
  muted: "border-border bg-transparent text-text-muted",
};

/** The label always carries the level in words; colour only reinforces it. */
export function TakeQualityBadge({
  quality,
  className = "",
}: Readonly<{ quality?: TakeQuality | null; className?: string }>) {
  const badge = takeQualityBadge(quality);
  return (
    <Badge variant="outline" className={`shrink-0 text-caption ${TONE_CLASS[badge.tone]} ${className}`}>
      QC: {badge.label}
    </Badge>
  );
}

interface TakeQualityPanelProps {
  quality?: TakeQuality | null;
  durationMs: number;
  /** Offered only for the take being trimmed; the editor presses it, nothing is applied silently. */
  onApplySuggestedIn?: (sourceInMs: number) => void;
}

/** Advisory automatic QC. It never changes technical validation or the human review. */
export function TakeQualityPanel({
  quality,
  durationMs,
  onApplySuggestedIn,
}: Readonly<TakeQualityPanelProps>) {
  const measurementRows = qualityMeasurementRows(quality?.metrics);
  const suggestedIn = suggestedSourceInMs(quality, durationMs);
  const unavailableReason =
    quality?.metrics?.status === "UNAVAILABLE" ? quality.metrics.reason : null;

  return (
    <div
      className="mt-2 space-y-1.5 rounded border border-border-soft bg-surface-panel p-2 text-caption"
      aria-label="QC tự động"
    >
      <div className="flex items-center justify-between gap-2 font-semibold">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <ScanSearch size={12} className="text-text-dim" /> QC tự động (tham khảo)
        </span>
        <TakeQualityBadge quality={quality} />
      </div>

      {!quality || quality.level === "UNMEASURED" ? (
        <p className="text-text-muted">
          {unavailableReason
            ? `Không đo được Take này: ${unavailableReason}.`
            : "Take này chưa được đo tự động."}
        </p>
      ) : quality.warnings.length === 0 ? (
        <p className="text-text-secondary">Các chỉ số đã đo đều trong ngưỡng.</p>
      ) : (
        <ul className="space-y-1">
          {quality.warnings.map((warning) => {
            const described = describeQualityWarning(warning);
            const Icon = warning.severity === "DEFECT" ? AlertCircle : AlertTriangle;
            return (
              <li
                key={warning.code}
                className={`flex items-start gap-1.5 ${
                  warning.severity === "DEFECT" ? "text-danger" : "text-warning"
                }`}
              >
                <Icon size={12} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  <span className="font-semibold">
                    {warning.severity === "DEFECT" ? "Lỗi" : "Cần xem"} · {described.title}.
                  </span>{" "}
                  <span className="text-text-secondary">{described.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {suggestedIn != null && onApplySuggestedIn && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onApplySuggestedIn(suggestedIn);
          }}
          className="cursor-pointer text-primary hover:underline"
        >
          Đặt In = {suggestedIn} ms để bỏ đoạn đứng hình đầu clip
        </button>
      )}

      {measurementRows.length > 0 && (
        <details>
          <summary className="cursor-pointer text-text-dim hover:text-text-muted">Chỉ số đã đo</summary>
          <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 font-mono text-text-secondary">
            {measurementRows.map((row) => (
              <div key={row.label} className="contents">
                <dt>{row.label}</dt>
                <dd className="text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      <p className="text-text-muted">
        Chưa đo ở nấc này: {UNMEASURED_CHECKS.join(", ")}.
        {quality?.thresholdsVersion ? ` Ngưỡng ${quality.thresholdsVersion}.` : ""}
      </p>
    </div>
  );
}
