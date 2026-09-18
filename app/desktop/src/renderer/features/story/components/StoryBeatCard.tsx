import { Volume2, Image as ImageIcon, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import type { DesktopStoryBeat } from "@narrativex/client-contracts";

export interface StoryBeatCardProps {
  beat: DesktopStoryBeat;
  selected: boolean;
  onSelect: () => void;
}

export function StoryBeatCard({ beat, selected, onSelect }: StoryBeatCardProps) {
  const primaryAudioCue = beat.audioCues[0];
  const primaryVisualBeat = beat.visualBeats[0];

  const durationSec = beat.timing.durationMs
    ? (beat.timing.durationMs / 1000).toFixed(1) + "s"
    : null;

  return (
    <div
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className={`group relative flex flex-col gap-2 rounded-lg border p-3.5 transition-all text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        selected
          ? "border-primary bg-surface-3 shadow-md ring-1 ring-primary"
          : "border-border-subtle bg-surface hover:border-border hover:bg-surface-2"
      }`}
    >
      {/* Beat Header: Index, Title, Purpose, Review Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] font-bold text-primary">
            #{beat.orderIndex + 1}
          </span>
          <span className="truncate text-[14px] font-semibold text-foreground">
            {beat.title || beat.purpose || `StoryBeat #${beat.orderIndex + 1}`}
          </span>
          <span className="rounded bg-surface-dark px-1.5 py-0.5 text-[10px] font-mono uppercase text-text-secondary">
            {beat.importance || "NORMAL"}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {durationSec && (
            <span className="flex items-center gap-1 rounded bg-surface-dark px-2 py-0.5 font-mono text-[11px] text-cyan">
              <Clock size={11} />
              <span>{durationSec}</span>
            </span>
          )}

          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border ${
              beat.reviewStatus === "APPROVED"
                ? "border-success/30 bg-success-bg text-success"
                : beat.reviewStatus === "NEEDS_REVIEW"
                ? "border-warning/30 bg-warning-bg text-warning"
                : "border-border-subtle bg-surface-dark text-text-muted"
            }`}
          >
            {beat.reviewStatus === "APPROVED" ? (
              <CheckCircle2 size={11} />
            ) : (
              <AlertCircle size={11} />
            )}
            <span>
              {beat.reviewStatus === "APPROVED"
                ? "Đã duyệt"
                : beat.reviewStatus === "NEEDS_REVIEW"
                ? "Cần duyệt"
                : "Chưa sẵn sàng"}
            </span>
          </span>
        </div>
      </div>

      {/* Semantic Summary */}
      {beat.summary && (
        <p className="text-[13px] leading-relaxed text-text-secondary line-clamp-2">
          {beat.summary}
        </p>
      )}

      {/* Cues & Visual Preview Grid */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border-subtle/60 text-[12px]">
        {/* Audio / Dialogue Snippet */}
        <div className="flex items-start gap-1.5 min-w-0 rounded bg-surface-dark/70 p-2">
          <Volume2 size={13} className="shrink-0 text-info mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium text-text-muted">
              {primaryAudioCue ? primaryAudioCue.cueType : "Audio Cue"}
            </span>
            <p className="truncate text-[12px] text-text-secondary italic">
              {primaryAudioCue?.adaptedText || primaryAudioCue?.deliveryHint || "Chưa có lời thoại / narration"}
            </p>
          </div>
        </div>

        {/* Visual Preview Snippet */}
        <div className="flex items-start gap-1.5 min-w-0 rounded bg-surface-dark/70 p-2">
          <ImageIcon size={13} className="shrink-0 text-primary mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium text-text-muted">
              {beat.visualBeats.length} Visual Beat{beat.visualBeats.length > 1 ? "s" : ""}
            </span>
            <p className="truncate text-[12px] text-text-secondary">
              {primaryVisualBeat?.visualIntent || primaryVisualBeat?.title || "Chưa có chỉ đạo hình ảnh"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
