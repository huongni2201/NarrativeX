import type { StoryboardGenerationBatch } from "@narrativex/client-contracts";
import { AlertTriangle, Loader2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoryboardVisualBeat } from "../api/storyboard.api";
import { unresolvedAttemptBeatIds, type GeminiQueueState } from "../model/gemini-queue";

export function GeminiQueueBanner({
  queue,
  currentBeat,
  processedCount,
  busy,
  preparedBatch,
  onResume,
  onSkip,
  onStop,
  onDismiss,
}: Readonly<{
  queue: GeminiQueueState;
  currentBeat: StoryboardVisualBeat | null;
  processedCount: number;
  busy: boolean;
  preparedBatch: StoryboardGenerationBatch | null;
  onResume: () => void;
  onSkip: () => void;
  onStop: () => void;
  onDismiss: () => void;
}>) {
  const total = queue.beatIds.length;
  const percent = total ? Math.round((processedCount / total) * 100) : 0;
  const completed = queue.status === "COMPLETED";
  const running = queue.status === "RUNNING";
  const unresolved = unresolvedAttemptBeatIds(queue).length;
  const blocked = Boolean(preparedBatch?.hasBlockingIssues || preparedBatch?.stale || unresolved);

  return (
    <div className="shrink-0 border-b border-border-subtle bg-surface-panel">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {running ? (
            <Loader2 size={13} className="shrink-0 animate-spin text-primary" />
          ) : blocked ? (
            <AlertTriangle size={13} className="shrink-0 text-warning" />
          ) : (
            <WandSparkles size={13} className="shrink-0 text-primary" />
          )}
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-[10px]">
              <span className="font-semibold text-foreground">Gemini All</span>
              <span className="tabular-nums text-text-dim">{processedCount}/{total} · {percent}%</span>
              <span className={`font-medium ${completed ? "text-success" : running ? "text-primary-hover" : "text-warning"}`}>
                {completed ? "Completed" : running ? "Running" : "Paused"}
              </span>
              <span className="font-mono text-text-dim" title={queue.batchId}>
                batch {queue.batchId.slice(0, 8)} · {queue.batchFingerprint.slice(0, 10)}
              </span>
            </div>
            <div className="max-w-[760px] truncate text-[10px] text-text-muted">
              {completed
                ? `${queue.completedBeatIds.length} generated · ${queue.skippedBeatIds.length} skipped · outputs still require review`
                : unresolved
                  ? `${unresolved} attempt(s) require reconciliation; automatic resubmit is disabled.`
                  : preparedBatch?.stale
                    ? "Prepared batch is stale; pending beats must be prepared again."
                    : currentBeat?.title ?? "Visual Beat"}
            </div>
            {preparedBatch ? (
              <div className="max-w-[760px] truncate text-[9px] text-text-dim">
                source {preparedBatch.sourceHash.slice(0, 10)} · storyboard {preparedBatch.storyboardRevisionId.slice(0, 8)} · continuity {preparedBatch.continuityPlanRevision ?? "-"}/{preparedBatch.continuityReportRevision ?? "-"} · style {preparedBatch.stylePolicyVersion}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {completed ? (
            <Button variant="ghost" size="sm" onClick={onDismiss}>Dismiss</Button>
          ) : running ? (
            <Button variant="outline" size="sm" onClick={onStop} className="text-danger hover:text-danger">Pause after in-flight</Button>
          ) : (
            <>
              <Button size="sm" disabled={!currentBeat || busy || Boolean(unresolved)} onClick={onResume}>
                <WandSparkles size={12} /> Resume
              </Button>
              <Button variant="outline" size="sm" disabled={!currentBeat || busy} onClick={onSkip}>Skip</Button>
              <Button variant="ghost" size="sm" onClick={onStop} className="text-danger hover:text-danger">Stop</Button>
            </>
          )}
        </div>
      </div>
      <div className="h-0.5 bg-surface-input">
        <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
