export interface AnalysisProgressProps {
  /** 0..100 from the backend job. */
  percent: number;
}

/** Determinate bar for a chapter analysis that is running; the percent comes from the backend job, not a guess. */
export function AnalysisProgress({ percent }: AnalysisProgressProps) {
  const value = Math.round(Math.max(0, Math.min(100, percent)));
  return (
    <div className="mt-2 flex items-center gap-3">
      <div
        role="progressbar"
        aria-label="Tiến độ phân tích chương"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-label tabular-nums text-foreground">{value}%</span>
    </div>
  );
}
