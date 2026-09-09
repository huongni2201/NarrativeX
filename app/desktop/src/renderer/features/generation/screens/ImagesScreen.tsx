import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  DesktopChapterDetails,
  DesktopTimeline,
  ImageGenerationProvider,
  MediaAspectRatio,
  MediaImageStyle,
} from "@narrativex/client-contracts";
import { Check, Image as ImageIcon, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assetsApi } from "../../assets/api/assets.api";
import { EmptyState, FeaturePage } from "../../workspace/components/FeaturePage";
import {
  InlineNotice,
  MetricStrip,
  PaneHeader,
  StatusIndicator,
  WorkspacePane,
  WorkspaceToolbar,
} from "../../workspace/components/WorkstationPrimitives";
import {
  isActiveGenerationJobStatus,
  isTerminalGenerationJobStatus,
} from "../generation-status";
import {
  useAnalyzeChapter,
  useCreateMediaJob,
  useCurrentMediaJob,
  useGenerationJob,
  useMediaJob,
  useReviewMediaItem,
} from "../queries/generation.queries";

type SubmissionIntent = { signature: string; idempotencyKey: string };

export function ImagesScreen({ projectId, chapters, timeline }: Readonly<{ projectId: string; chapters: DesktopChapterDetails[]; timeline: DesktopTimeline | null }>) {
  const analyze = useAnalyzeChapter();
  const createJob = useCreateMediaJob();
  const review = useReviewMediaItem();
  const [chapterId, setChapterId] = useState("");
  const [imageStyle, setImageStyle] = useState<MediaImageStyle>("CINEMATIC");
  const [imageProvider, setImageProvider] = useState<ImageGenerationProvider>("API");
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [mediaJobId, setMediaJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const analysisIntentRef = useRef<SubmissionIntent | null>(null);
  const mediaIntentRef = useRef<SubmissionIntent | null>(null);

  const currentMediaJob = useCurrentMediaJob(projectId, chapterId || null);
  const effectiveMediaJobId = mediaJobId ?? currentMediaJob.data?.jobId ?? null;
  const analysisJob = useGenerationJob(analysisJobId);
  const mediaGenerationJob = useGenerationJob(effectiveMediaJobId);
  const mediaJob = useMediaJob(effectiveMediaJobId);

  useEffect(() => {
    if (!chapterId && chapters[0]) setChapterId(chapters[0].id);
  }, [chapterId, chapters]);

  useEffect(() => {
    setAnalysisJobId(null);
    setMediaJobId(null);
    setNotice(null);
    analysisIntentRef.current = null;
    mediaIntentRef.current = null;
  }, [chapterId]);

  useEffect(() => {
    setMediaJobId(null);
    analysisIntentRef.current = null;
    mediaIntentRef.current = null;
  }, [imageProvider]);

  useEffect(() => {
    mediaIntentRef.current = null;
  }, [imageStyle, timeline?.aspectRatio]);

  useEffect(() => {
    if (isTerminalGenerationJobStatus(mediaGenerationJob.data?.status)) mediaIntentRef.current = null;
  }, [mediaGenerationJob.data?.status]);

  const beats = timeline?.beats.filter((beat) => beat.chapterId === chapterId) ?? [];
  const analysisBusy = analyze.isPending || Boolean(analysisJobId && (analysisJob.isLoading || isActiveGenerationJobStatus(analysisJob.data?.status)));
  const mediaBusy = createJob.isPending || Boolean(effectiveMediaJobId && (mediaGenerationJob.isLoading || isActiveGenerationJobStatus(mediaGenerationJob.data?.status)));
  const mediaHeadChecking = currentMediaJob.isLoading;
  const mediaHeadUnavailable = currentMediaJob.isError;
  const mediaSubmissionBlocked = mediaHeadChecking || mediaHeadUnavailable;

  async function runAnalysis() {
    if (!chapterId || analysisBusy) return;
    setNotice(null);
    const signature = [projectId, chapterId, "IMAGE", imageProvider].join(":");
    if (analysisIntentRef.current?.signature !== signature) {
      analysisIntentRef.current = { signature, idempotencyKey: crypto.randomUUID() };
    }
    try {
      const job = await analyze.mutateAsync({
        projectId,
        chapterId,
        request: { visualGenerationMode: "IMAGE", imageProvider },
        idempotencyKey: analysisIntentRef.current.idempotencyKey,
      });
      analysisIntentRef.current = null;
      setAnalysisJobId(job.jobId);
      setNotice(`Analysis ${job.jobId.slice(0, 8)} đã được queue cho ${formatProvider(imageProvider)}.`);
    } catch (error) {
      setNotice(toMessage(error));
    }
  }


  async function generateImages() {
    if (imageProvider === "GEMINI_WEB") {
      setNotice("Gemini Web tạo ảnh mới cho từng Visual Beat trong Storyboard. Không có API media job cho provider này.");
      return;
    }
    if (!chapterId || mediaBusy || mediaSubmissionBlocked || analysisBusy || !beats.length) return;
    setNotice(null);
    try {
      const aspectRatio = asAspectRatio(timeline?.aspectRatio);
      const signature = [projectId, chapterId, imageStyle, imageProvider, aspectRatio].join(":");
      if (mediaIntentRef.current?.signature !== signature) mediaIntentRef.current = { signature, idempotencyKey: crypto.randomUUID() };
      const job = await createJob.mutateAsync({
        projectId,
        chapterId,
        idempotencyKey: mediaIntentRef.current.idempotencyKey,
        request: {
          productionMode: "IMAGE_MOTION",
          aspectRatio,
          imageStyle,
          visualGenerationMode: "IMAGE",
          imageProvider,
        },
      });
      setMediaJobId(job.jobId);
      setNotice(`Media job ${job.jobId.slice(0, 8)} đã được queue; mỗi visual beat sẽ tạo một ảnh mới bằng profile chất lượng cao mặc định.`);
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  function reviewItem(itemId: string, rowVersion: number, decision: "APPROVED" | "REJECTED") {
    setNotice(null);
    review.mutate(
      { itemId, jobId: effectiveMediaJobId ?? undefined, review: { decision, rowVersion } },
      {
        onSuccess: () => setNotice(decision === "APPROVED" ? "Ảnh đã được duyệt." : "Ảnh đã bị từ chối."),
        onError: (error) => setNotice(toMessage(error)),
      },
    );
  }

  const generateLabel = imageProvider === "GEMINI_WEB"
    ? "Use Storyboard"
    : mediaHeadChecking
      ? "Checking…"
      : mediaHeadUnavailable
        ? "Unavailable"
        : mediaBusy
          ? "Generating…"
          : "Generate images";

  return (
    <FeaturePage
      title="Image Generation"
      description="Analyze, generate và review image output theo từng Visual Beat."
      contentClassName="min-h-0 overflow-hidden bg-background p-0"
    >
      <div className="flex h-full min-h-0 flex-col">
        <WorkspaceToolbar>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <Select value={chapterId || undefined} onValueChange={setChapterId}>
              <SelectTrigger aria-label="Chapter" className="min-w-[210px]"><SelectValue placeholder="Chọn chapter" /></SelectTrigger>
              <SelectContent>{chapters.map((chapter) => <SelectItem key={chapter.id} value={chapter.id}>{chapter.title}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={imageProvider} onValueChange={(value) => setImageProvider(value as ImageGenerationProvider)}>
              <SelectTrigger aria-label="Provider" className="min-w-[128px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="GEMINI_WEB">Gemini Web</SelectItem><SelectItem value="API">API</SelectItem></SelectContent>
            </Select>
            <Select value={imageStyle} disabled={imageProvider === "GEMINI_WEB"} onValueChange={(value) => setImageStyle(value as MediaImageStyle)}>
              <SelectTrigger aria-label="Image style" className="min-w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="CINEMATIC">Cinematic</SelectItem><SelectItem value="STORYBOOK_WATERCOLOR">Storybook watercolor</SelectItem></SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => void runAnalysis()} disabled={!chapterId || analysisBusy || mediaBusy}>{analysisBusy ? "Analyzing…" : "Analyze"}</Button>
          </div>
          <Button
            size="sm"
            onClick={() => void generateImages()}
            disabled={!chapterId || !beats.length || analysisBusy || (imageProvider === "API" && (mediaBusy || mediaSubmissionBlocked))}
          >
            <Sparkles size={13} /> {generateLabel}
          </Button>
        </WorkspaceToolbar>

        <div className="shrink-0 border-b border-border-subtle bg-surface-panel px-3 py-1.5">
          <MetricStrip
            items={[
              { label: "beats", value: beats.length },
              { label: "provider", value: formatProvider(imageProvider) },
              { label: "profile", value: imageProvider === "API" ? "Premium" : "Gemini Web" },
              { label: "analysis", value: analysisJob.data?.status ?? "idle" },
              { label: "generation", value: mediaGenerationJob.data?.status ?? "idle" },
            ]}
          />
        </div>

        {imageProvider === "GEMINI_WEB" ? <InlineNotice tone="info">Gemini Web generate/import theo từng Visual Beat trong Storyboard; API media job không được tạo.</InlineNotice> : null}
        {notice ? <InlineNotice>{notice}</InlineNotice> : null}
        {mediaHeadUnavailable && imageProvider === "API" ? <InlineNotice tone="warning">Không thể xác định media job hiện tại. Generate đã khóa để tránh gửi trùng.</InlineNotice> : null}

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(230px,280px)_minmax(0,1fr)] overflow-hidden">
          <WorkspacePane className="flex flex-col border-r border-border-subtle bg-surface-panel">
            <PaneHeader title="Visual Beats" meta={`${beats.length} in selected chapter`} />
            <div className="min-h-0 flex-1 overflow-y-auto">
              {beats.map((beat, index) => (
                <div key={beat.visualBeatId} className="border-l-2 border-l-transparent border-b border-b-border-subtle px-3 py-2 hover:bg-surface-hover">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-medium text-text-dim">Beat {index + 1}</span>
                    <StatusIndicator label={formatProvider(imageProvider)} tone={imageProvider === "GEMINI_WEB" ? "accent" : "neutral"} />
                  </div>
                  <strong className="mt-0.5 block truncate text-[11px] font-semibold text-foreground">{beat.title}</strong>
                  <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-text-muted">{beat.visualIntent}</p>
                </div>
              ))}
              {!beats.length ? <EmptyState title="Chưa có visual beat" description="Analyze chapter để tạo scene/visual beat trước." /> : null}
            </div>
          </WorkspacePane>

          <WorkspacePane className="flex flex-col">
            <PaneHeader
              title="Media Review"
              meta={imageProvider === "GEMINI_WEB" ? "Review continues in Storyboard" : `${mediaJob.data?.items.length ?? 0} items`}
              actions={analysisJob.data || mediaGenerationJob.data ? <StatusIndicator label={mediaBusy ? "Processing" : "Ready"} tone={mediaBusy ? "warning" : "success"} /> : undefined}
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {imageProvider === "GEMINI_WEB" ? (
                <EmptyState title="Review trong Storyboard" description="Import ảnh vào từng beat rồi approve trực tiếp trong Storyboard." />
              ) : mediaJob.data?.items.length ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5">
                  {mediaJob.data.items.map((item) => (
                    <article key={item.id} className="min-w-0 overflow-hidden border border-border-subtle bg-surface-panel">
                      <MediaItemPreview projectId={projectId} mediaAssetId={item.mediaAssetId} visualBeatId={item.visualBeatId} executionStatus={item.executionStatus} />
                      <div className="p-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <ImageIcon size={13} className="shrink-0 text-primary" />
                          <strong className="truncate text-[10px] text-foreground" title={item.itemKey ?? item.visualBeatId}>{item.itemKey ?? item.visualBeatId}</strong>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <StatusIndicator label={item.executionStatus} tone={item.executionStatus === "READY" ? "success" : "neutral"} />
                          <span className="text-[9px] text-text-dim">{item.reviewStatus}</span>
                        </div>
                        {item.reviewStatus === "NEEDS_REVIEW" && item.executionStatus === "READY" ? (
                          <div className="mt-2 flex gap-1.5 border-t border-border-subtle pt-2">
                            <Button size="sm" className="flex-1" onClick={() => reviewItem(item.id, item.rowVersion, "APPROVED")} disabled={review.isPending || !item.mediaAssetId}><Check size={12} /> Approve</Button>
                            <Button variant="outline" size="sm" className="text-danger hover:text-danger" onClick={() => reviewItem(item.id, item.rowVersion, "REJECTED")} disabled={review.isPending || !item.mediaAssetId}><X size={12} /> Reject</Button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="Chưa có media job" description="Generate images để theo dõi và review output." />
              )}
            </div>
          </WorkspacePane>
        </div>
      </div>
    </FeaturePage>
  );
}

function MediaItemPreview({ projectId, mediaAssetId, visualBeatId, executionStatus }: Readonly<{ projectId: string; mediaAssetId: string | null; visualBeatId: string; executionStatus: string }>) {
  const [imageFailed, setImageFailed] = useState(false);
  const preview = useQuery({
    queryKey: ["projects", projectId, "assets", mediaAssetId ?? "none", "download-url"],
    queryFn: () => assetsApi.downloadUrl(projectId, mediaAssetId as string),
    enabled: Boolean(mediaAssetId) && executionStatus === "READY",
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => setImageFailed(false), [preview.data?.url]);
  if (executionStatus !== "READY" || !mediaAssetId) return <PreviewPlaceholder>Ảnh đang được xử lý…</PreviewPlaceholder>;
  if (preview.isLoading) return <PreviewPlaceholder>Đang tải preview…</PreviewPlaceholder>;
  if (preview.isError || !preview.data?.url || imageFailed) {
    return (
      <div className="grid aspect-video place-items-center gap-2 border-b border-warning/30 bg-warning-bg p-3 text-center text-[9px] text-warning">
        <span>Không tải được ảnh preview.</span>
        <Button type="button" size="sm" variant="outline" onClick={() => { setImageFailed(false); void preview.refetch(); }}>Thử lại</Button>
      </div>
    );
  }
  return <img src={preview.data.url} alt={`Generated visual beat ${visualBeatId}`} className="aspect-video w-full border-b border-border-subtle bg-background object-cover" loading="lazy" onError={() => setImageFailed(true)} />;
}

function PreviewPlaceholder({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="grid aspect-video place-items-center border-b border-border-subtle bg-surface-dark text-[9px] text-text-muted">{children}</div>;
}

function asAspectRatio(value: string | undefined): MediaAspectRatio {
  return value === "9:16" || value === "1:1" || value === "4:3" || value === "3:4" ? value : "16:9";
}

function formatProvider(value: ImageGenerationProvider) {
  return value === "GEMINI_WEB" ? "Gemini Web" : "API";
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Generation request thất bại.";
}
