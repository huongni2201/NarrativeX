import { Loader2, WandSparkles } from "lucide-react";
import type { StoryboardVisualBeat } from "../api/storyboard.api";
import type { GeminiQueueState } from "../model/gemini-queue";

export function GeminiQueueBanner({
  queue,
  currentBeat,
  processedCount,
  busy,
  onResume,
  onSkip,
  onStop,
  onDismiss,
}: Readonly<{
  queue: GeminiQueueState;
  currentBeat: StoryboardVisualBeat | null;
  processedCount: number;
  busy: boolean;
  onResume: () => void;
  onSkip: () => void;
  onStop: () => void;
  onDismiss: () => void;
}>) {
  const total = queue.beatIds.length;
  const percent = total ? Math.round((processedCount / total) * 100) : 0;
  const completed = queue.status === "COMPLETED";
  const running = queue.status === "RUNNING";

  return (
    <div className="mx-5 mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary-hover">
            Gemini Web · Generate All
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-foreground">
            {running && <Loader2 size={13} className="animate-spin" />}
            {completed
              ? `Hoàn tất ${queue.completedBeatIds.length}/${total} ảnh`
              : running
                ? `${processedCount}/${total} · Chrome đang generate ${currentBeat?.title ?? "Visual Beat"}`
                : `${processedCount}/${total} · Tạm dừng tại ${currentBeat?.title ?? "Visual Beat"}`}
          </div>
          <div className="mt-1 text-[10px] text-text-muted">
            {queue.completedBeatIds.length} generated · {queue.skippedBeatIds.length} skipped · {percent}%
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {completed ? (
            <button
              type="button"
              onClick={onDismiss}
              className="h-8 rounded-md border border-border bg-surface-input px-3 text-[11px] font-semibold text-text-secondary hover:bg-surface-2"
            >
              Dismiss
            </button>
          ) : running ? (
            <button
              type="button"
              onClick={onStop}
              className="h-8 rounded-md border border-danger/30 px-3 text-[11px] font-semibold text-danger hover:bg-danger/5"
            >
              Stop after current
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={!currentBeat || busy}
                onClick={onResume}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-bold text-white hover:bg-primary-hover disabled:opacity-50"
              >
                <WandSparkles size={12} /> Retry & Resume
              </button>
              <button
                type="button"
                disabled={!currentBeat || busy}
                onClick={onSkip}
                className="h-8 rounded-md border border-border bg-surface-input px-3 text-[11px] font-semibold text-text-secondary hover:bg-surface-2 disabled:opacity-50"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={onStop}
                className="h-8 rounded-md border border-danger/30 px-3 text-[11px] font-semibold text-danger hover:bg-danger/5"
              >
                Stop
              </button>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-input">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      {!completed && (
        <p className="mt-2 text-[10px] leading-4 text-text-muted">
          NarrativeX resolve nhân vật xuất hiện trong từng beat, attach tối đa 3 locked reference theo đúng REF mapping, gửi Gemini Images, bắt output trực tiếp qua Chrome Network và chỉ dùng nút Download làm fallback.
        </p>
      )}
    </div>
  );
}
