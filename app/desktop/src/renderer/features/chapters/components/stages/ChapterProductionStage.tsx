import { useState, useMemo } from "react";
import { productionStageStatus } from "../../model/production-stage-status";
import {
  Sparkles,
  Volume2,
  Film,
  Clock,
  UserCheck,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Info,
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
import { storyboardApi } from "../../../storyboard/api/storyboard.api";
import { VideoShotboard } from "../../../storyboard/components/VideoShotboard";
import { useUpdateVisualBeatReview } from "../../../storyboard/queries/storyboard.queries";
import { invalidatePreviewMediaQueries } from "../../../storyboard/queries/storyboard-media.queries";
import { importLocalMedia } from "../../../assets/services/import-local-media";
import { useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const [copiedPromptBeatId, setCopiedPromptBeatId] = useState<string | null>(null);
  const [mediaBusyBeatId, setMediaBusyBeatId] = useState<string | null>(null);
  const [mediaImportMessage, setMediaImportMessage] = useState<string | null>(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  const updateVisualBeatReview = useUpdateVisualBeatReview(projectId, chapter?.id ?? null);

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
        map.set(b.visualBeatId, b);
      }
    }
    return map;
  }, [timeline]);

  if (!chapter || !story) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-text-muted">
        <Film size={44} className="mb-2 text-text-dim" />
        <p className="text-[15px]">
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
    updateVisualBeatReview.mutate({
      beat,
      status,
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
    if (!chapter) return;
    setMediaBusyBeatId(beat.id);
    setMediaImportMessage(null);
    let importedAssetId: string | null = null;
    let previewBound = false;
    try {
      const result = await importLocalMedia({
        projectId,
        allowedKinds: ["IMAGE"],
      });
      if (result) {
        importedAssetId = result.assetId;
        await storyboardApi.attachPreviewMedia(
          projectId,
          chapter.id,
          beat.sceneId,
          beat.id,
          beat.rowVersion,
          result.assetId,
        );
        previewBound = true;
        setMediaImportMessage(null);
        await invalidatePreviewMediaQueries(queryClient, projectId, chapter.id);
      }
    } catch (err) {
      console.warn("Failed to import replacement media:", err);
      const assetRetained =
        err instanceof Error && err.message.includes("remains in the Asset Library");
      setMediaImportMessage(
        importedAssetId && !previewBound
          ? "Ảnh đã được nhập vào Thư viện nhưng chưa gắn làm ảnh xem trước. Bạn có thể thử lại hoặc xóa ảnh đó trong Thư viện."
          : previewBound
            ? "Ảnh đã được gắn nhưng chế độ xem chưa làm mới. Hãy tải lại phòng sản xuất."
            : assetRetained
              ? "Không thể hoàn tất nhập ảnh; một asset còn trong Thư viện để bạn kiểm tra hoặc xóa."
              : "Không thể nhập ảnh xem trước. Hãy kiểm tra file rồi thử lại.",
      );
      if ((importedAssetId && !previewBound) || assetRetained) {
        await invalidatePreviewMediaQueries(queryClient, projectId, chapter.id).catch((refreshError) =>
          console.warn("Failed to refresh retained preview image", refreshError),
        );
      }
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
            <span className="text-[16px] font-semibold text-foreground">
              Phòng điều khiển sản xuất
            </span>
            <span className="rounded bg-surface-3 px-2 py-0.5 text-caption font-mono text-text-secondary">
              {chapter.title}
            </span>
          </div>

          <div className="flex items-center gap-2 border-l border-border-subtle pl-4 text-label">
            <span className="text-text-muted">Tiến độ sản xuất video:</span>
            <strong className="text-primary font-mono text-[15px]">
              {overallProgressPercent}%
            </strong>
            <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full bg-primary transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-300"
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
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-body font-semibold text-primary-foreground transition-[color,background-color,border-color,box-shadow,transform,opacity] hover:bg-primary-hover shadow-md disabled:opacity-50"
          title="Sinh Video Shots tự động với mô hình LTX-2.5 video-first cho toàn bộ chapter"
        >
          <Sparkles size={15} className={isGenerating ? "animate-spin" : ""} />
          <span>
            {isGenerating
              ? "Đang sản xuất video shots..."
              : totalShots > 0 && shotsGeneratedCount < totalShots
              ? "Tạo các shot còn thiếu"
              : "Sản xuất Video Shots (LTX)"}
          </span>
        </button>
      </div>

      {/* Creator-First Production Readiness Strip */}
      <div className="border-b border-border-subtle bg-surface-panel px-5 py-2.5 text-label">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-5 text-text-secondary">
            {/* Story & Narration Audio */}
            <div className="flex items-center gap-1.5" title="Trạng thái file âm thanh kể chuyện (Narration Audio)">
              <Volume2 size={14} className={audioReady ? "text-success" : "text-text-dim"} />
              <span className="text-text-muted">Narration Audio:</span>
              <span className={`font-semibold font-mono ${audioReady ? "text-success" : "text-warning"}`}>
                {audioReady === null ? "—" : audioReady ? "Ready" : "Pending"}
              </span>
            </div>

            {/* Voice Profile */}
            <div className="flex items-center gap-1.5" title="Trạng thái hồ sơ giọng đọc nhân vật">
              <UserCheck size={14} className={voiceReady ? "text-purple-400" : "text-text-dim"} />
              <span className="text-text-muted">Voice:</span>
              <span className={`font-semibold font-mono ${voiceReady ? "text-purple-400" : "text-text-dim"}`}>
                {voiceReady === null ? "—" : voiceReady ? "Ready" : "Blocked"}
              </span>
            </div>

            {/* Video Shots ready */}
            <div className="flex items-center gap-1.5" title="Số lượng video shots đã sinh hoàn tất">
              <Film size={14} className="text-primary" />
              <span className="text-text-muted">Video Shots:</span>
              <span className="font-semibold font-mono text-foreground">
                {shotsGeneratedCount} / {Math.max(1, totalShots)}
              </span>
            </div>

            {/* Word Alignment QC */}
            <div className="flex items-center gap-1.5" title="Số lượng shots đã vượt qua kiểm định Word Alignment & QC">
              <Clock size={14} className={qcPassedCount >= totalShots && totalShots > 0 ? "text-success" : "text-cyan-400"} />
              <span className="text-text-muted">Word Alignment QC:</span>
              <span className="font-semibold font-mono text-foreground">
                {qcPassedCount} / {Math.max(1, totalShots)}
              </span>
            </div>

            {/* Editor readiness */}
            <div className="flex items-center gap-1.5 border-l border-border-subtle pl-4">
              <ShieldCheck size={14} className={editorReady ? "text-success" : "text-text-dim"} />
              <span className={editorReady ? "text-success font-semibold" : "text-text-dim font-medium"}>
                {editorReady ? "Timeline Editor Sẵn sàng" : "Chờ shots"}
              </span>
            </div>
          </div>

          {/* Technical Details Toggle */}
          <button
            type="button"
            onClick={() => setShowTechDetails((prev) => !prev)}
            className="inline-flex items-center gap-1 text-caption font-mono text-text-dim hover:text-foreground transition-colors"
          >
            <Info size={12} />
            <span>Kỹ thuật LTX</span>
            {showTechDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Collapsible Technical Details */}
        {showTechDetails && (
          <div className="mt-2 flex items-center gap-4 rounded-md border border-border-subtle bg-surface-dark px-3 py-1.5 font-mono text-caption text-text-dim">
            <span>Model: <strong className="text-foreground">LTX-2.5 22B Distilled (Native AV)</strong></span>
            <span>Độ phân giải: <strong className="text-foreground">1280x720 (720p)</strong></span>
            <span>Khung hình: <strong className="text-foreground">24 FPS Cinematic</strong></span>
            <span>Âm thanh: <strong className="text-foreground">Native AV (Embedded)</strong></span>
          </div>
        )}
      </div>

      {/* Main Canonical Production Workspace: VideoShotboard */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {mediaImportMessage && (
          <div
            className="mx-4 mt-3 rounded-md border border-warning bg-surface-panel p-3 text-label text-warning"
            role="status"
          >
            {mediaImportMessage}
          </div>
        )}
        <div className="p-4">
          <VideoShotboard
            projectId={projectId}
            chapterId={chapter.id}
            beats={visualBeats}
            hasSelectedScene={allBeats.length > 0}
            selectedSceneBeatCount={allBeats.length}
            timelineBeats={timelineBeats}
            updating={updateVisualBeatReview.isPending}
            mediaBusyBeatId={mediaBusyBeatId}
            copiedPromptBeatId={copiedPromptBeatId}
            onReview={handleReview}
            onCopyPrompt={handleCopyPrompt}
            onImport={handleImport}
          />
        </div>
      </div>
    </div>
  );
}
