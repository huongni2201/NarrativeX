import { useState } from "react";
import {
  Sparkles,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Film,
  Clock,
  ChevronDown,
  ChevronRight,
  UserCheck,
  ShieldCheck,
  Check,
} from "lucide-react";
import type {
  DesktopChapterDetails,
  DesktopChapterStory,
  DesktopShot,
  DesktopStoryBeat,
} from "@narrativex/client-contracts";

export interface ChapterProductionStageProps {
  chapter: DesktopChapterDetails | null;
  story: DesktopChapterStory | null;
  onGenerateVideoShots?: () => void;
  isGenerating?: boolean;
}

export function ChapterProductionStage({
  chapter,
  story,
  onGenerateVideoShots,
  isGenerating = false,
}: ChapterProductionStageProps) {
  const [expandedBeatIds, setExpandedBeatIds] = useState<Record<string, boolean>>({});

  if (!chapter || !story) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-text-muted">
        <Film size={44} className="mb-2 text-text-dim" />
        <p className="text-[14px]">
          Vui lòng hoàn thành phân tích kịch bản tại mục Source trước khi vào phòng sản xuất.
        </p>
      </div>
    );
  }

  const allBeats: DesktopStoryBeat[] = story.scenes.flatMap((s) => s.storyBeats);
  const totalBeats = allBeats.length;

  // 1. Story / Dialogue Readiness & Narration Audio
  const dialogueReadyCount = allBeats.filter(
    (b) => b.audioCues.length > 0 && b.timing.durationMs !== null
  ).length;

  // 2. Voice Identity Readiness
  const allAudioCues = allBeats.flatMap((b) => b.audioCues);
  const totalCues = allAudioCues.length;
  const voiceAssignedCount = allAudioCues.filter(
    (c) => Boolean(c.speakerProjectCharacterId) || Boolean(c.speakerName)
  ).length;

  // 3. Video Shot Generation
  const allShots: DesktopShot[] = allBeats
    .flatMap((b) => b.visualBeats)
    .flatMap((v) => v.shotSequence?.shots ?? []);
  const totalShots = allShots.length;
  const shotsGeneratedCount = allShots.filter(
    (s) =>
      Boolean(s.selectedTake) ||
      s.status === "SELECTED" ||
      s.status === "PASSED" ||
      s.takes.length > 0
  ).length;

  // 4. Validation / QC (Word Alignment & Quality Verification)
  const qcPassedCount = allShots.filter(
    (s) =>
      s.status === "SELECTED" ||
      s.status === "PASSED" ||
      s.takes.some((t) => t.status === "PASSED")
  ).length;

  // 5. Editor Readiness
  const editorReady = totalShots > 0 && shotsGeneratedCount >= Math.ceil(totalShots * 0.8);
  const overallProgressPercent =
    totalBeats > 0
      ? Math.round(
          ((dialogueReadyCount + voiceAssignedCount + shotsGeneratedCount + qcPassedCount) /
            (totalBeats + Math.max(1, totalCues) + Math.max(1, totalShots) * 2)) *
            100
        )
      : 0;

  const toggleBeatExpand = (beatId: string) => {
    setExpandedBeatIds((prev) => ({ ...prev, [beatId]: !prev[beatId] }));
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Control Room Header & Overall Action */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-dark px-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-foreground">
              Phòng điều khiển sản xuất
            </span>
            <span className="rounded bg-surface-3 px-2 py-0.5 text-[11px] font-mono text-text-secondary">
              {chapter.title}
            </span>
          </div>

          <div className="flex items-center gap-2 border-l border-border-subtle pl-4 text-[12px]">
            <span className="text-text-muted">Tiến độ sản xuất video:</span>
            <strong className="text-primary font-mono text-[14px]">
              {overallProgressPercent}%
            </strong>
            <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${overallProgressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onGenerateVideoShots}
          disabled={isGenerating}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-all hover:bg-primary-hover shadow-md disabled:opacity-50"
          title="Sinh Video Shots tự động với mô hình LTX-2.5 video-first cho toàn bộ chapter"
        >
          <Sparkles size={15} className={isGenerating ? "animate-spin" : ""} />
          <span>
            {isGenerating
              ? "Đang sản xuất video shots..."
              : "Generate Video Shots (Sản xuất Video LTX)"}
          </span>
        </button>
      </div>

      {/* Production Readiness Status Cards (5 Stages) */}
      <div className="grid grid-cols-5 gap-3 border-b border-border-subtle bg-surface-panel p-4 text-[13px]">
        {/* 1. Story / Dialogue Readiness (Narration Audio) */}
        <div className="rounded-lg border border-border-subtle bg-surface p-3">
          <div className="flex items-center justify-between text-text-muted mb-1 text-[11px] uppercase tracking-wider font-medium">
            <span>Story & Narration Audio</span>
            <Volume2 size={14} className="text-info" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[18px] font-bold text-foreground font-mono">
              {dialogueReadyCount} / {totalBeats}
            </span>
            <span className="text-[11px] text-text-secondary">Beats sẵn sàng</span>
          </div>
        </div>

        {/* 2. Voice Identity Readiness */}
        <div className="rounded-lg border border-border-subtle bg-surface p-3">
          <div className="flex items-center justify-between text-text-muted mb-1 text-[11px] uppercase tracking-wider font-medium">
            <span>Voice Identity Readiness</span>
            <UserCheck size={14} className="text-purple-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[18px] font-bold text-foreground font-mono">
              {voiceAssignedCount} / {Math.max(1, totalCues)}
            </span>
            <span className="text-[11px] text-text-secondary">Cues có voice</span>
          </div>
        </div>

        {/* 3. Video Shot Generation (Video Shots) */}
        <div className="rounded-lg border border-border-subtle bg-surface p-3">
          <div className="flex items-center justify-between text-text-muted mb-1 text-[11px] uppercase tracking-wider font-medium">
            <span>Video Shot Generation (Video Shots)</span>
            <Film size={14} className="text-primary" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[18px] font-bold text-foreground font-mono">
              {shotsGeneratedCount} / {Math.max(1, totalShots)}
            </span>
            <span className="text-[11px] text-text-secondary">Shots sinh xong</span>
          </div>
        </div>

        {/* 4. Validation / QC (Word Alignment & Quality Verification) */}
        <div className="rounded-lg border border-border-subtle bg-surface p-3">
          <div className="flex items-center justify-between text-text-muted mb-1 text-[11px] uppercase tracking-wider font-medium">
            <span>Validation / QC (Word Alignment)</span>
            <Clock size={14} className="text-cyan-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[18px] font-bold text-foreground font-mono">
              {qcPassedCount} / {Math.max(1, totalShots)}
            </span>
            <span className="text-[11px] text-text-secondary">QC Đạt chuẩn</span>
          </div>
        </div>

        {/* 5. Editor Readiness */}
        <div className="rounded-lg border border-border-subtle bg-surface p-3">
          <div className="flex items-center justify-between text-text-muted mb-1 text-[11px] uppercase tracking-wider font-medium">
            <span>Timeline Editor Sẵn sàng</span>
            <ShieldCheck
              size={14}
              className={editorReady ? "text-success" : "text-text-dim"}
            />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[18px] font-bold text-foreground font-mono">
              {editorReady ? "SẴN SÀNG" : "CHỜ SHOTS"}
            </span>
            <span className="text-[11px] text-text-secondary">Direct to Timeline</span>
          </div>
        </div>
      </div>

      {/* Beats & Video Shots Control List */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
        <h4 className="text-[12px] font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">
          Danh sách điều khiển StoryBeats & Video Shots ({totalBeats} beats)
        </h4>

        {allBeats.map((beat) => {
          const hasAudio = beat.audioCues.length > 0;
          const isAudioAligned = beat.timing.durationMs !== null;
          const visualBeats = beat.visualBeats;
          const shots = visualBeats.flatMap((v) => v.shotSequence?.shots ?? []);
          const isExpanded = Boolean(expandedBeatIds[beat.id]);

          return (
            <div
              key={beat.id}
              className="rounded-lg border border-border-subtle bg-surface overflow-hidden transition-colors hover:border-border"
            >
              {/* Beat Row Header */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleBeatExpand(beat.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleBeatExpand(beat.id);
                  }
                }}
                className="flex items-center justify-between p-3 cursor-pointer select-none bg-surface-panel/40 hover:bg-surface-panel/70"
              >
                <div className="flex items-center gap-3 min-w-0 max-w-[45%]">
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-text-muted shrink-0" />
                  ) : (
                    <ChevronRight size={16} className="text-text-muted shrink-0" />
                  )}
                  <span className="font-mono text-[11px] font-bold text-primary shrink-0">
                    #{beat.orderIndex + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="text-[13px] font-semibold text-foreground truncate block">
                      {beat.title || beat.purpose || `Beat #${beat.orderIndex + 1}`}
                    </span>
                    <span className="text-[11px] text-text-muted truncate block">
                      {beat.summary}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-5 text-[12px]">
                  {/* Audio Status */}
                  <div className="flex items-center gap-1.5">
                    <Volume2
                      size={14}
                      className={hasAudio ? "text-info" : "text-text-dim"}
                    />
                    <span
                      className={
                        hasAudio ? "text-foreground font-medium" : "text-text-muted"
                      }
                    >
                      {hasAudio ? (isAudioAligned ? "Audio OK" : "Chờ Align") : "Thiếu Audio"}
                    </span>
                  </div>

                  {/* Video Shots Count */}
                  <div className="flex items-center gap-1.5">
                    <Film
                      size={14}
                      className={shots.length > 0 ? "text-primary" : "text-text-dim"}
                    />
                    <span className="font-mono">
                      {shots.filter((s) => Boolean(s.selectedTake)).length} / {shots.length} Takes
                    </span>
                  </div>

                  {/* Review Badge */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                      beat.reviewStatus === "APPROVED"
                        ? "border-success/30 bg-success-bg text-success"
                        : "border-warning/30 bg-warning-bg text-warning"
                    }`}
                  >
                    {beat.reviewStatus === "APPROVED" ? (
                      <CheckCircle2 size={11} />
                    ) : (
                      <AlertTriangle size={11} />
                    )}
                    <span>{beat.reviewStatus === "APPROVED" ? "Hoàn tất" : "Cần duyệt"}</span>
                  </span>
                </div>
              </div>

              {/* Collapsible Shot Detail Area */}
              {isExpanded && (
                <div className="p-3 border-t border-border-subtle bg-surface-dark/30 space-y-3">
                  {/* Audio Cues preview */}
                  {beat.audioCues.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                        Lời thoại & Audio Cues:
                      </span>
                      <div className="space-y-1">
                        {beat.audioCues.map((cue) => (
                          <div
                            key={cue.id}
                            className="text-[12px] rounded bg-surface px-2.5 py-1.5 border border-border-subtle flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-semibold text-primary">
                                {cue.speakerName || "Người dẫn chuyện"}:
                              </span>
                              <span className="italic text-text-secondary truncate">
                                "{cue.adaptedText}"
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-text-dim shrink-0">
                              {cue.cueType}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Planned Video Shots & Takes */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      Video Shots (Kế hoạch cảnh quay LTX):
                    </span>
                    {shots.length === 0 ? (
                      <div className="text-[12px] text-text-muted italic p-2 bg-surface rounded border border-border-subtle">
                        Chưa có cảnh quay nào được phân bổ cho StoryBeat này.
                      </div>
                    ) : (
                      shots.map((shot) => (
                        <div
                          key={shot.id}
                          className="rounded border border-border-subtle bg-surface p-2.5 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-foreground">
                                Shot #{shot.orderIndex + 1}
                              </span>
                              {shot.retentionRole && (
                                <span className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-mono text-primary font-medium">
                                  {shot.retentionRole}
                                </span>
                              )}
                              <span className="text-[12px] text-foreground font-medium">
                                {shot.narrativePurpose}
                              </span>
                            </div>

                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-mono font-medium uppercase border ${
                                shot.status === "SELECTED" || shot.status === "PASSED"
                                  ? "border-success/30 bg-success-bg text-success"
                                  : shot.status === "GENERATING"
                                  ? "border-info/30 bg-info-bg text-info"
                                  : "border-border-subtle bg-surface-2 text-text-muted"
                              }`}
                            >
                              {shot.status}
                            </span>
                          </div>

                          {/* Camera & Motion Meta */}
                          <div className="flex items-center gap-4 text-[11px] text-text-muted font-mono">
                            <span>Thời lượng: {shot.targetDurationMs}ms</span>
                            {shot.camera && <span>Camera: {shot.camera}</span>}
                            {shot.subjectMotion && <span>Chuyển động: {shot.subjectMotion}</span>}
                          </div>

                          {/* Takes List */}
                          {shot.takes.length > 0 && (
                            <div className="mt-1 space-y-1 pt-1 border-t border-border-subtle">
                              <span className="text-[10px] uppercase tracking-wider text-text-dim font-medium">
                                Danh sách Takes ({shot.takes.length} attempts):
                              </span>
                              {shot.takes.map((take) => {
                                const isSelected = shot.selectedTake?.takeId === take.id;
                                return (
                                  <div
                                    key={take.id}
                                    className={`flex items-center justify-between rounded px-2 py-1 text-[11px] border ${
                                      isSelected
                                        ? "border-primary/50 bg-primary/5 text-foreground"
                                        : "border-border-subtle bg-surface-2 text-text-secondary"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 font-mono">
                                      <span className="font-bold">Attempt #{take.attemptNumber}</span>
                                      <span>({take.provider} / {take.model})</span>
                                      {take.sourceDurationMs && (
                                        <span>{take.sourceDurationMs}ms</span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {isSelected && (
                                        <span className="inline-flex items-center gap-1 text-primary text-[10px] font-bold">
                                          <Check size={11} /> Master Take
                                        </span>
                                      )}
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                          take.status === "PASSED"
                                            ? "bg-success-bg text-success"
                                            : "bg-surface-3 text-text-muted"
                                        }`}
                                      >
                                        {take.status}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
