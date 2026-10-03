import { useState, useMemo } from "react";
import { productionStageStatus } from "../../model/production-stage-status";
import {
  Sparkles,
  Volume2,
  Film,
  Clock,
  UserCheck,
  ShieldCheck,
} from "lucide-react";
import type {
  ChapterProductionStatus,
  DesktopChapterDetails,
  DesktopChapterStory,
  DesktopStoryBeat,
  DesktopTimeline,
  DesktopTimelineBeat,
  GenerationJob,
} from "@narrativex/client-contracts";
import type {
  StoryboardVisualBeat,
  VisualBeatReviewStatus,
} from "../../../storyboard/api/storyboard.api";
import { VideoShotboard } from "../../../storyboard/components/VideoShotboard";
import { useUpdateStoryBeatReviewStatus } from "../../../story/queries/story.queries";

export interface ChapterProductionStageProps {
  projectId?: string;
  chapter: DesktopChapterDetails | null;
  story: DesktopChapterStory | null;
  timeline?: DesktopTimeline | null;
  productionStatus?: ChapterProductionStatus | null;
  activeGenerationJob?: GenerationJob | null;
  onGenerateVideoShots?: () => void;
  isGenerating?: boolean;
}

export function ChapterProductionStage({
  projectId = "",
  chapter,
  story,
  timeline,
  productionStatus,
  activeGenerationJob: _activeGenerationJob,
  onGenerateVideoShots,
  isGenerating = false,
}: ChapterProductionStageProps) {
  const [copiedPromptBeatId, setCopiedPromptBeatId] = useState<string | null>(null);
  const [mediaBusyBeatId, setMediaBusyBeatId] = useState<string | null>(null);

  const updateBeatReview = useUpdateStoryBeatReviewStatus(projectId, chapter?.id ?? "");

  const allBeats: DesktopStoryBeat[] = useMemo(
    () => (story ? story.scenes.flatMap((s) => s.storyBeats) : []),
    [story]
  );

  const visualBeats: StoryboardVisualBeat[] = useMemo(() => {
    return allBeats.flatMap((b) =>
      b.visualBeats.map((vb) => ({
        id: vb.id,
        sceneId: vb.sceneId,
        orderIndex: vb.orderIndex,
        title: vb.title,
        visualIntent: vb.visualIntent,
        visualDirectionJson: vb.visualDirectionJson ?? null,
        prompt: vb.prompt ?? null,
        motionMode: vb.motionMode ?? "DYNAMIC",
        reviewStatus: (vb.reviewStatus === "APPROVED" ? "APPROVED" : "NEEDS_REVIEW") as VisualBeatReviewStatus,
        aspectRatioOverride: vb.aspectRatioOverride ?? null,
        previewMediaAssetId: vb.previewMediaAssetId ?? null,
        dramaticIntent: vb.dramaticIntent ?? null,
        emotion: vb.emotion ?? null,
        retentionRole: vb.retentionRole ?? null,
        shotSequence: vb.shotSequence ?? null,
        rowVersion: vb.rowVersion,
      }))
    );
  }, [allBeats]);

  const timelineBeats = useMemo(() => {
    const map = new Map<string, DesktopTimelineBeat>();
    if (timeline?.beats) {
      for (const b of timeline.beats) {
        map.set(b.id, b);
      }
    }
    return map;
  }, [timeline]);

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

  const {
    audioReady,
    totalShots,
    shotsGeneratedCount,
    qcPassedCount,
    editorReady,
    generationReady,
    overallProgressPercent,
    voiceReady,
  } = productionStageStatus(productionStatus);

  const handleReview = (beat: StoryboardVisualBeat, status: VisualBeatReviewStatus) => {
    updateBeatReview.mutate({
      storyBeatId: beat.id,
      status,
      rowVersion: beat.rowVersion,
    });
  };

  const handleCopyPrompt = (beat: StoryboardVisualBeat) => {
    if (beat.prompt) {
      void navigator.clipboard.writeText(beat.prompt);
      setCopiedPromptBeatId(beat.id);
      setTimeout(() => setCopiedPromptBeatId(null), 2000);
    }
  };

  const handleImport = async (beat: StoryboardVisualBeat) => {
    setMediaBusyBeatId(beat.id);
    try {
      if (window.narrativex?.dialog?.showOpenDialog) {
        const result = await window.narrativex.dialog.showOpenDialog({
          title: `Chọn media thay thế cho ${beat.title}`,
          filters: [{ name: "Video / Image", extensions: ["mp4", "webm", "png", "jpg", "jpeg"] }],
          properties: ["openFile"],
        });
        if (!result.canceled && result.filePaths.length > 0) {
          const filePath = result.filePaths[0];
          await window.narrativex.localProjects.importMedia(projectId, filePath);
        }
      }
    } catch {
      // Handled silently
    } finally {
      setMediaBusyBeatId(null);
    }
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
          disabled={isGenerating || !generationReady}
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
              {audioReady === null ? "—" : audioReady ? "Ready" : "Pending"}
            </span>
            <span className="text-[11px] text-text-secondary">Narration asset</span>
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
              {voiceReady === null ? "—" : voiceReady ? "Ready" : "Blocked"}
            </span>
            <span className="text-[11px] text-text-secondary">Required profile check</span>
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

      {/* Main Canonical Production Workspace: VideoShotboard */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <VideoShotboard
          projectId={projectId}
          chapterId={chapter.id}
          beats={visualBeats}
          hasSelectedScene={allBeats.length > 0}
          selectedSceneBeatCount={allBeats.length}
          timelineBeats={timelineBeats}
          updating={updateBeatReview.isPending}
          mediaBusyBeatId={mediaBusyBeatId}
          copiedPromptBeatId={copiedPromptBeatId}
          onReview={handleReview}
          onCopyPrompt={handleCopyPrompt}
          onImport={handleImport}
        />
      </div>
    </div>
  );
}
