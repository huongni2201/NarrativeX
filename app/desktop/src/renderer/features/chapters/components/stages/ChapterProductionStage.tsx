import { useState, useMemo, type ReactNode } from "react";
import { productionNextStep, productionStageStatus } from "../../model/production-stage-status";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Volume2,
  Film,
  UserCheck,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Info,
  ArrowRight,
  CheckCheck,
} from "lucide-react";
import type {
  ChapterProductionStatus,
  DesktopChapterDetails,
  DesktopChapterStory,
  DesktopStoryBeat,
  DesktopTimeline,
  GenerationJob,
} from "../../../../../shared/api-types";
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
import { ChapterBulkReview } from "../ChapterBulkReview";
import { BulkTakeReview } from "../../../storyboard/components/BulkTakeReview";

export interface ChapterProductionStageProps {
  projectId?: string;
  chapter: DesktopChapterDetails | null;
  story: DesktopChapterStory | null;
  timeline?: DesktopTimeline | null;
  productionStatus?: ChapterProductionStatus | null;
  activeGenerationJob?: GenerationJob | null;
  onGenerateVideoShots?: () => void;
  isGenerating?: boolean;
  statusError?: boolean;
  onRetryStatus?: () => void;
  onNavigateToSource?: () => void;
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
  statusError = false,
  onRetryStatus,
  onNavigateToSource,
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

  const sceneTitleById = useMemo(
    () => new Map((story?.scenes ?? []).map((scene) => [scene.id, scene.title])),
    [story],
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
        retentionRole: vb.retentionRole ?? null,
        shotSequence: vb.shotSequence ?? null,
        rowVersion: vb.rowVersion,
      }))
    );
  }, [allBeats]);

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
    editorReady,
    generationReady,
    overallProgressPercent,
    voiceReady,
  } = productionStageStatus(productionStatus);
  const nextStep = productionNextStep(productionStatus);
  const selectedCount = productionStatus?.selectedTakeCount ?? 0;

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
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface-dark px-5 py-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-[16px] font-semibold text-foreground">
              Phòng điều khiển sản xuất
            </span>
            <span className="max-w-full truncate rounded bg-surface-3 px-2 py-0.5 text-caption text-text-secondary" title={chapter.title}>
              {chapter.title}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-label">
            <span className="text-text-muted">Shot đã chọn Take:</span>
            <strong className="text-primary font-mono text-[15px]">
              {productionStatus ? totalShots > 0 ? `${selectedCount}/${totalShots} · ${overallProgressPercent}%` : "Chưa có Shot" : "Chưa có dữ liệu"}
            </strong>
            {productionStatus && totalShots > 0 && <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Tỷ lệ Shot đã chọn Take" aria-valuemin={0} aria-valuemax={100} aria-valuenow={overallProgressPercent}>
              <div
                className="h-full bg-primary transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-300"
                style={{ width: `${overallProgressPercent}%` }}
              />
            </div>}
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onGenerateVideoShots}
          disabled={isGenerating || !generationReady || !onGenerateVideoShots || statusError}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-body font-semibold text-primary-foreground transition-[color,background-color,border-color,box-shadow,transform,opacity] hover:bg-primary-hover shadow-md disabled:opacity-50"
          title="Sinh Video Shots tự động với mô hình LTX-2.5 video-first cho toàn bộ chapter"
        >
          <Sparkles size={15} className={isGenerating ? "animate-spin" : ""} />
          <span>
            {isGenerating
              ? "Đang sản xuất video shots..."
              : totalShots > 0 && shotsGeneratedCount < totalShots
              ? "Tạo các shot còn thiếu"
              : "Tạo Video Shots"}
          </span>
        </button>
      </div>

      {/* Creator-First Production Readiness Strip */}
      <div className="border-b border-border-subtle bg-surface-panel px-5 py-2.5 text-label">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-text-secondary">
            <StatusChip
              icon={<Volume2 size={14} />}
              label="Narration:"
              value={audioReady === null ? "—" : audioReady ? "Sẵn sàng" : "Đang chờ"}
              tone={audioReady ? "success" : audioReady === null ? "neutral" : "warning"}
              title="Trạng thái file âm thanh kể chuyện (Narration Audio)"
            />
            <StatusChip
              icon={<UserCheck size={14} />}
              label="Giọng nhân vật:"
              value={voiceReady === null ? "—" : voiceReady ? "Sẵn sàng" : "Bị chặn"}
              tone={voiceReady ? "success" : voiceReady === null ? "neutral" : "warning"}
              title="Trạng thái hồ sơ giọng đọc nhân vật"
            />
            <StatusChip
              icon={<Film size={14} />}
              label="Shot có Take đạt kỹ thuật:"
              value={productionStatus ? `${shotsGeneratedCount} / ${totalShots}` : "—"}
              tone={totalShots > 0 && shotsGeneratedCount >= totalShots ? "success" : "neutral"}
              title="Shot có Take đạt kiểm tra kỹ thuật; vẫn cần duyệt nội dung trước khi chọn."
            />
            <StatusChip
              icon={<CheckCheck size={14} />}
              label="Đã chọn Take:"
              value={productionStatus ? `${selectedCount} / ${totalShots}` : "—"}
              tone={totalShots > 0 && selectedCount === totalShots ? "success" : "neutral"}
              title="Số Shot đã chọn Take và lưu In/Out để dựng."
            />
            <StatusChip
              icon={<ShieldCheck size={14} />}
              label=""
              value={!productionStatus ? "Timeline: chưa có dữ liệu" : editorReady ? "Timeline sẵn sàng" : "Timeline chưa sẵn sàng"}
              tone={editorReady ? "success" : "neutral"}
            />
          </div>

          {/* Technical Details Toggle */}
          <button
            type="button"
            onClick={() => setShowTechDetails((prev) => !prev)}
            aria-expanded={showTechDetails}
            aria-controls="production-technical-details"
            className="inline-flex items-center gap-1 text-caption font-mono text-text-dim hover:text-foreground transition-colors"
          >
            <Info size={12} />
            <span>Kỹ thuật LTX</span>
            {showTechDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Collapsible Technical Details */}
        {showTechDetails && (
          <div id="production-technical-details" className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border-subtle bg-surface-dark px-3 py-1.5 font-mono text-caption text-text-dim">
            <span>Model: <strong className="text-foreground">LTX-2.5 22B Distilled (Native AV)</strong></span>
            <span>Độ phân giải: <strong className="text-foreground">1280x720 (720p)</strong></span>
            <span>Khung hình: <strong className="text-foreground">24 FPS Cinematic</strong></span>
            <span>Âm thanh: <strong className="text-foreground">Native AV (Embedded)</strong></span>
          </div>
        )}
      </div>

      {/* Main Canonical Production Workspace: VideoShotboard */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="mx-4 my-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-panel p-4" aria-label="Bước tiếp theo" aria-live="polite">
          <div className="min-w-0 flex-1 basis-72">
            <p className="mb-1 text-caption font-semibold uppercase tracking-wide text-primary">Bước tiếp theo</p>
            <h3 className="text-body font-semibold text-foreground">{statusError ? "Không cập nhật được trạng thái sản xuất" : nextStep.title}</h3>
            <p className="mt-1 text-label leading-relaxed text-text-secondary">{statusError ? "Hãy tải lại trạng thái trước khi tiếp tục. Dữ liệu đang hiển thị có thể đã cũ." : nextStep.detail}</p>
            {!statusError && productionStatus && (productionStatus.failedShots > 0 || productionStatus.manualReviewShots > 0) && <p className="mt-2 text-label text-warning">{productionStatus.failedShots} Shot lỗi · {productionStatus.manualReviewShots} Shot cần duyệt thủ công. Kiểm tra chi tiết bên dưới.</p>}
          </div>
          {statusError && onRetryStatus ? (
            <button type="button" onClick={onRetryStatus} className="nx-timeline-action">Tải lại trạng thái</button>
          ) : !statusError && productionStatus && (!productionStatus.storyReady || totalShots === 0) && onNavigateToSource ? (
            <button type="button" onClick={onNavigateToSource} className="nx-timeline-action">Mở Nội dung gốc<ArrowRight size={14} aria-hidden="true" /></button>
          ) : !statusError && nextStep.destination ? (
            <Link to={`/projects/${projectId}/${nextStep.destination}`} className="nx-timeline-action">
              {nextStep.destination === "audio" ? "Mở Âm thanh" : "Mở trình dựng"}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          ) : null}
        </section>
        <div className="mx-4 mb-3 space-y-3">
          <ChapterBulkReview key={chapter.id} projectId={projectId} chapterId={chapter.id} story={story} />
          <BulkTakeReview key={`takes-${chapter.id}`} projectId={projectId} chapterId={chapter.id} />
        </div>
        {mediaImportMessage && (
          <div
            className="mx-4 mt-3 rounded-md border border-warning bg-surface-panel p-3 text-label text-warning"
            role="status"
          >
            {mediaImportMessage}
          </div>
        )}
        <div className="px-4 pb-4">
          <VideoShotboard
            projectId={projectId}
            chapterId={chapter.id}
            beats={visualBeats}
            sceneTitleById={sceneTitleById}
            hasSelectedScene={allBeats.length > 0}
            selectedSceneBeatCount={allBeats.length}
            timelineBeats={timeline?.beats ?? []}
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

const STATUS_CHIP_TONES = {
  success: "text-success",
  warning: "text-warning",
  neutral: "text-foreground",
} as const;

function StatusChip({
  icon,
  label,
  value,
  tone,
  title,
}: Readonly<{
  icon: ReactNode;
  label: string;
  value: string;
  tone: keyof typeof STATUS_CHIP_TONES;
  title?: string;
}>) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-dark px-2.5 py-1"
      title={title}
    >
      <span className={tone === "neutral" ? "text-text-dim" : STATUS_CHIP_TONES[tone]}>{icon}</span>
      {label && <span className="text-text-muted">{label}</span>}
      <span className={`font-mono font-semibold ${STATUS_CHIP_TONES[tone]}`}>{value}</span>
    </div>
  );
}
