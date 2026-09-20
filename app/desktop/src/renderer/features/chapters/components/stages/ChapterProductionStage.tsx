import { useState } from "react";
import {
  Sparkles,
  Volume2,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Play,
  Film,
  Clock,
} from "lucide-react";
import type { DesktopChapterDetails, DesktopChapterStory } from "@narrativex/client-contracts";

export interface ChapterProductionStageProps {
  chapter: DesktopChapterDetails | null;
  story: DesktopChapterStory | null;
  onGenerateVideoShots?: () => void;
  onGenerateMissing?: () => void;
  isGenerating?: boolean;
}

export function ChapterProductionStage({
  chapter,
  story,
  onGenerateVideoShots,
  onGenerateMissing,
  isGenerating = false,
}: ChapterProductionStageProps) {
  const handleTriggerGeneration = onGenerateVideoShots ?? onGenerateMissing;

  if (!chapter || !story) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-text-muted">
        <Film size={44} className="mb-2 text-text-dim" />
        <p className="text-[14px]">Vui lòng hoàn thành phân tích kịch bản tại mục Source trước khi vào phòng sản xuất.</p>
      </div>
    );
  }

  const allBeats = story.scenes.flatMap((s) => s.storyBeats);
  const totalBeats = allBeats.length;
  const audioReadyCount = allBeats.filter((b) => b.audioCues.length > 0 && b.timing.durationMs !== null).length;
  const totalVisuals = allBeats.reduce((acc, b) => acc + b.visualBeats.length, 0);
  const visualsReadyCount = allBeats.reduce(
    (acc, b) => acc + b.visualBeats.filter((v) => v.reviewStatus === "APPROVED" || Boolean(v.previewMediaAssetId)).length,
    0
  );

  const progressPercent = totalBeats > 0 ? Math.round(((audioReadyCount + visualsReadyCount) / (totalBeats + Math.max(1, totalVisuals))) * 100) : 0;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Control Room Header & Overall Action */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-dark px-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-foreground">Phòng điều khiển sản xuất</span>
            <span className="rounded bg-surface-3 px-2 py-0.5 text-[11px] font-mono text-text-secondary">
              {chapter.title}
            </span>
          </div>

          <div className="flex items-center gap-2 border-l border-border-subtle pl-4 text-[12px]">
            <span className="text-text-muted">Tiến độ tổng thể:</span>
            <strong className="text-primary font-mono text-[14px]">{progressPercent}%</strong>
            <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Primary CTA: Generate Video Shots */}
        <button
          type="button"
          onClick={handleTriggerGeneration}
          disabled={isGenerating}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-all hover:bg-primary-hover shadow-md disabled:opacity-50"
          title="Tự động kiểm tra và sinh toàn bộ Video Shots (LTX-2.5) cho chương này"
        >
          <Sparkles size={15} className={isGenerating ? "animate-spin" : ""} />
          <span>{isGenerating ? "Đang xử lý sinh video..." : "Generate Video Shots (Sản xuất Video)"}</span>
        </button>
      </div>

      {/* Production Readiness Status Counters */}
      <div className="grid grid-cols-4 gap-3 border-b border-border-subtle bg-surface-panel p-4 text-[13px]">
        <div className="rounded-lg border border-border-subtle bg-surface p-3">
          <div className="flex items-center justify-between text-text-muted mb-1 text-[11px] uppercase tracking-wider font-medium">
            <span>Narration Audio (VieNeu)</span>
            <Volume2 size={14} className="text-info" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[18px] font-bold text-foreground font-mono">
              {audioReadyCount} / {totalBeats}
            </span>
            <span className="text-[11px] text-text-secondary">Beats sẵn sàng</span>
          </div>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface p-3">
          <div className="flex items-center justify-between text-text-muted mb-1 text-[11px] uppercase tracking-wider font-medium">
            <span>Word Alignment (WhisperX)</span>
            <Clock size={14} className="text-cyan" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[18px] font-bold text-foreground font-mono">
              {audioReadyCount > 0 ? "ĐÃ ALIGN" : "CHỜ AUDIO"}
            </span>
            <span className="text-[11px] text-text-secondary">Master Clock</span>
          </div>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface p-3">
          <div className="flex items-center justify-between text-text-muted mb-1 text-[11px] uppercase tracking-wider font-medium">
            <span>Video Shots (LTX-2.5)</span>
            <Film size={14} className="text-primary" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[18px] font-bold text-foreground font-mono">
              {visualsReadyCount} / {totalVisuals}
            </span>
            <span className="text-[11px] text-text-secondary">Shots / Takes sẵn sàng</span>
          </div>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface p-3">
          <div className="flex items-center justify-between text-text-muted mb-1 text-[11px] uppercase tracking-wider font-medium">
            <span>Timeline Editor Sẵn sàng</span>
            <Film size={14} className="text-success" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[18px] font-bold text-foreground font-mono">
              {progressPercent >= 80 ? "SẴN SÀNG" : "ĐANG DỰNG"}
            </span>
            <span className="text-[11px] text-text-secondary">Direct to Render</span>
          </div>
        </div>
      </div>

      {/* Beats Status List (StoryBeat-grouped Control Rows) */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-2">
        <h4 className="text-[12px] font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">
          Danh sách kiểm soát theo từng StoryBeat ({totalBeats} beats)
        </h4>

        {allBeats.map((beat) => {
          const hasAudio = beat.audioCues.length > 0;
          const isAudioAligned = beat.timing.durationMs !== null;
          const visualsCount = beat.visualBeats.length;
          const visualsApproved = beat.visualBeats.filter((v) => v.reviewStatus === "APPROVED").length;

          return (
            <div
              key={beat.id}
              className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface p-3 transition-colors hover:border-border"
            >
              {/* Beat Info */}
              <div className="flex items-center gap-3 min-w-0 max-w-[40%]">
                <span className="font-mono text-[11px] font-bold text-primary">#{beat.orderIndex + 1}</span>
                <div className="min-w-0">
                  <span className="text-[13px] font-semibold text-foreground truncate block">
                    {beat.title || beat.purpose || `Beat #${beat.orderIndex + 1}`}
                  </span>
                  <span className="text-[11px] text-text-muted truncate block">
                    {beat.summary}
                  </span>
                </div>
              </div>

              {/* Status Columns */}
              <div className="flex items-center gap-6 text-[12px]">
                {/* Audio Status */}
                <div className="flex items-center gap-2">
                  <Volume2 size={14} className={hasAudio ? "text-info" : "text-text-dim"} />
                  <span className={hasAudio ? "text-foreground font-medium" : "text-text-muted"}>
                    {hasAudio ? (isAudioAligned ? "Audio OK" : "Chờ Align") : "Thiếu Audio"}
                  </span>
                </div>

                {/* Video Shots Status */}
                <div className="flex items-center gap-2">
                  <Film size={14} className={visualsCount > 0 ? "text-primary" : "text-text-dim"} />
                  <span className="font-mono">
                    {visualsApproved} / {visualsCount} Shots
                  </span>
                </div>

                {/* Overall Beat Review Status */}
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                    beat.reviewStatus === "APPROVED"
                      ? "border-success/30 bg-success-bg text-success"
                      : "border-warning/30 bg-warning-bg text-warning"
                  }`}
                >
                  {beat.reviewStatus === "APPROVED" ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                  <span>{beat.reviewStatus === "APPROVED" ? "Hoàn tất" : "Cần duyệt"}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
