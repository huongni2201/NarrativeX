import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  DesktopChapterDetails,
  DesktopTimeline,
  MediaAspectRatio,
  MediaImageStyle,
  MediaJobCostEstimate,
  MediaQualityTier,
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
  isActiveGenerationJobStatus,
  isTerminalGenerationJobStatus,
} from "../generation-status";
import {
  useAnalyzeChapter,
  useCreateMediaJob,
  useCurrentMediaJob,
  useEstimateMediaJob,
  useGenerationJob,
  useMediaJob,
  useReviewMediaItem,
} from "../queries/generation.queries";

export function ImagesScreen({
  projectId,
  chapters,
  timeline,
}: Readonly<{
  projectId: string;
  chapters: DesktopChapterDetails[];
  timeline: DesktopTimeline | null;
}>) {
  const analyze = useAnalyzeChapter();
  const estimate = useEstimateMediaJob();
  const createJob = useCreateMediaJob();
  const review = useReviewMediaItem();
  const [chapterId, setChapterId] = useState("");
  const [qualityTier, setQualityTier] = useState<MediaQualityTier>("STANDARD");
  const [imageStyle, setImageStyle] = useState<MediaImageStyle>("CINEMATIC");
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [mediaJobId, setMediaJobId] = useState<string | null>(null);
  const [costEstimate, setCostEstimate] = useState<MediaJobCostEstimate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mediaIntentRef = useRef<{ signature: string; idempotencyKey: string } | null>(null);

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
    setCostEstimate(null);
    setNotice(null);
    mediaIntentRef.current = null;
  }, [chapterId]);

  useEffect(() => {
    setCostEstimate(null);
    mediaIntentRef.current = null;
  }, [imageStyle, qualityTier, timeline?.aspectRatio]);

  useEffect(() => {
    if (isTerminalGenerationJobStatus(mediaGenerationJob.data?.status)) {
      mediaIntentRef.current = null;
    }
  }, [mediaGenerationJob.data?.status]);

  const beats = timeline?.beats.filter((beat) => beat.chapterId === chapterId) ?? [];
  const analysisBusy =
    analyze.isPending ||
    Boolean(
      analysisJobId &&
        (analysisJob.isLoading || isActiveGenerationJobStatus(analysisJob.data?.status)),
    );
  const mediaBusy =
    createJob.isPending ||
    Boolean(
      effectiveMediaJobId &&
        (mediaGenerationJob.isLoading ||
          isActiveGenerationJobStatus(mediaGenerationJob.data?.status)),
    );
  const mediaHeadChecking = currentMediaJob.isLoading;
  const mediaHeadUnavailable = currentMediaJob.isError;
  const mediaSubmissionBlocked = mediaHeadChecking || mediaHeadUnavailable;

  async function runAnalysis() {
    if (!chapterId || analysisBusy) return;
    setNotice(null);
    try {
      const job = await analyze.mutateAsync({ projectId, chapterId });
      setAnalysisJobId(job.jobId);
      setNotice(`Analysis ${job.jobId.slice(0, 8)} đã được queue.`);
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  async function estimateCost(): Promise<MediaJobCostEstimate | null> {
    if (!chapterId) return null;
    setNotice(null);
    try {
      const result = await estimate.mutateAsync({ projectId, chapterId, qualityTier });
      setCostEstimate(result);
      setNotice(
        `Ước tính ${result.estimatedCost} ${result.currency} cho ${result.visualBeatCount} visual beat.`,
      );
      return result;
    } catch (error) {
      setNotice(toMessage(error));
      return null;
    }
  }

  async function generateImages() {
    if (!chapterId || mediaBusy || mediaSubmissionBlocked || analysisBusy || !beats.length) return;
    setNotice(null);
    try {
      const latestEstimate = await estimateCost();
      if (!latestEstimate) return;
      const maxAuthorizedCost = Number(latestEstimate.estimatedCost);
      if (!Number.isFinite(maxAuthorizedCost) || maxAuthorizedCost <= 0) {
        setNotice("Không có chi phí image generation hợp lệ để authorize.");
        return;
      }

      const aspectRatio = asAspectRatio(timeline?.aspectRatio);
      const signature = [
        projectId,
        chapterId,
        qualityTier,
        imageStyle,
        aspectRatio,
        latestEstimate.estimatedCost,
      ].join(":");
      if (mediaIntentRef.current?.signature !== signature) {
        mediaIntentRef.current = { signature, idempotencyKey: crypto.randomUUID() };
      }

      const job = await createJob.mutateAsync({
        projectId,
        chapterId,
        idempotencyKey: mediaIntentRef.current.idempotencyKey,
        request: {
          productionMode: "IMAGE_MOTION",
          aspectRatio,
          qualityTier,
          maxAuthorizedCost,
          imageStyle,
        },
      });
      setMediaJobId(job.jobId);
      setNotice(
        `Media job ${job.jobId.slice(0, 8)} đã được queue với cap ${latestEstimate.estimatedCost} ${latestEstimate.currency}.`,
      );
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  function reviewItem(
    itemId: string,
    rowVersion: number,
    decision: "APPROVED" | "REJECTED",
  ) {
    setNotice(null);
    review.mutate(
      {
        itemId,
        jobId: effectiveMediaJobId ?? undefined,
        review: { decision, rowVersion },
      },
      {
        onSuccess: () =>
          setNotice(decision === "APPROVED" ? "Ảnh đã được duyệt." : "Ảnh đã bị từ chối."),
        onError: (error) => setNotice(toMessage(error)),
      },
    );
  }

  const generateLabel = mediaHeadChecking
    ? "Checking…"
    : mediaHeadUnavailable
      ? "Unavailable"
      : mediaBusy
        ? "Generating…"
        : "Generate images";

  return (
    <FeaturePage
      title="Image Generation"
      description="Analyze chapter, estimate cost, generate image assets và review từng media item trong generation feature riêng."
      actions={
        <Button
          size="sm"
          onClick={() => void generateImages()}
          disabled={
            !chapterId ||
            !beats.length ||
            analysisBusy ||
            mediaBusy ||
            mediaSubmissionBlocked ||
            estimate.isPending
          }
        >
          <Sparkles size={14} /> {generateLabel}
        </Button>
      }
    >
      <div className="grid gap-3">
        <section className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
          <Field label="Chapter">
            <Select value={chapterId || undefined} onValueChange={setChapterId}>
              <SelectTrigger className="min-w-[230px]">
                <SelectValue placeholder="Chọn chapter" />
              </SelectTrigger>
              <SelectContent>
                {chapters.map((chapter) => (
                  <SelectItem key={chapter.id} value={chapter.id}>
                    {chapter.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Quality">
            <Select
              value={qualityTier}
              onValueChange={(value) => setQualityTier(value as MediaQualityTier)}
            >
              <SelectTrigger className="min-w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="STANDARD">Standard</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Image style">
            <Select
              value={imageStyle}
              onValueChange={(value) => setImageStyle(value as MediaImageStyle)}
            >
              <SelectTrigger className="min-w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CINEMATIC">Cinematic</SelectItem>
                <SelectItem value="STORYBOOK_WATERCOLOR">Storybook watercolor</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Button
            variant="outline"
            onClick={() => void runAnalysis()}
            disabled={!chapterId || analysisBusy || mediaBusy}
          >
            {analysisBusy ? "Analyzing…" : "Analyze"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void estimateCost()}
            disabled={!chapterId || estimate.isPending || mediaBusy}
          >
            {estimate.isPending ? "Estimating…" : "Estimate cost"}
          </Button>
        </section>

        {costEstimate && (
          <div className="rounded-md border border-border bg-card p-3 text-[10px] text-muted-foreground">
            Cost estimate · {costEstimate.estimatedCost} {costEstimate.currency} · {costEstimate.visualBeatCount} visual beat
          </div>
        )}
        {notice && (
          <p className="text-[10px] text-muted-foreground" role="status" aria-live="polite">
            {notice}
          </p>
        )}
        {analysisJob.data && (
          <div className="rounded-md border border-border bg-card p-3 text-[10px] text-muted-foreground">
            Analysis {analysisJob.data.jobId.slice(0, 8)} · {analysisJob.data.status} ·{" "}
            {Math.round(analysisJob.data.progress * 100)}%
          </div>
        )}
        {mediaGenerationJob.data && (
          <div className="rounded-md border border-border bg-card p-3 text-[10px] text-muted-foreground">
            Generation {mediaGenerationJob.data.jobId.slice(0, 8)} · {mediaGenerationJob.data.status} ·{" "}
            {Math.round(mediaGenerationJob.data.progress * 100)}%
          </div>
        )}
        {mediaHeadUnavailable && (
          <p className="text-[10px] text-warning" role="status">
            Không thể xác định media job hiện tại. Generate đã được khóa để tránh gửi trùng; hãy thử tải lại màn hình.
          </p>
        )}

        <section className="grid grid-cols-[minmax(240px,.7fr)_minmax(0,1.3fr)] gap-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <span className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">
              Visual beats
            </span>
            <div className="mt-2 grid gap-2">
              {beats.map((beat) => (
                <div
                  key={beat.visualBeatId}
                  className="rounded-md border border-border-subtle bg-popover p-2"
                >
                  <strong className="text-[10px]">{beat.title}</strong>
                  <p className="mt-1 text-[9px] leading-4 text-muted-foreground">
                    {beat.visualIntent}
                  </p>
                </div>
              ))}
              {!beats.length && (
                <EmptyState
                  title="Chưa có visual beat"
                  description="Analyze chapter để tạo scene/visual beat trước."
                />
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3">
            <span className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">
              Media review
            </span>
            <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2">
              {mediaJob.data?.items.map((item) => (
                <article
                  key={item.id}
                  className="grid gap-2 rounded-md border border-border-subtle bg-popover p-3"
                >
                  <MediaItemPreview
                    mediaAssetId={item.mediaAssetId}
                    visualBeatId={item.visualBeatId}
                    executionStatus={item.executionStatus}
                  />
                  <div className="flex items-center gap-2">
                    <ImageIcon size={16} className="text-primary-hover" />
                    <strong
                      className="truncate text-[10px]"
                      title={item.itemKey ?? item.visualBeatId}
                    >
                      {item.itemKey ?? item.visualBeatId}
                    </strong>
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {item.executionStatus} · {item.reviewStatus}
                  </span>
                  {item.reviewStatus === "NEEDS_REVIEW" && item.executionStatus === "READY" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => reviewItem(item.id, item.rowVersion, "APPROVED")}
                        disabled={review.isPending || !item.mediaAssetId}
                      >
                        <Check size={12} /> Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => reviewItem(item.id, item.rowVersion, "REJECTED")}
                        disabled={review.isPending || !item.mediaAssetId}
                      >
                        <X size={12} /> Reject
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </div>
            {!mediaJob.data?.items.length && (
              <EmptyState
                title="Chưa có media job"
                description="Generate images để theo dõi và review output."
              />
            )}
          </div>
        </section>
      </div>
    </FeaturePage>
  );
}

function MediaItemPreview({
  mediaAssetId,
  visualBeatId,
  executionStatus,
}: Readonly<{
  mediaAssetId: string | null;
  visualBeatId: string;
  executionStatus: string;
}>) {
  const [imageFailed, setImageFailed] = useState(false);
  const preview = useQuery({
    queryKey: ["assets", mediaAssetId ?? "none", "download-url"],
    queryFn: () => assetsApi.downloadUrl(mediaAssetId as string),
    enabled: Boolean(mediaAssetId) && executionStatus === "READY",
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    setImageFailed(false);
  }, [preview.data?.url]);

  if (executionStatus !== "READY" || !mediaAssetId) {
    return (
      <div className="grid aspect-video place-items-center rounded-md border border-border-subtle bg-background text-[9px] text-muted-foreground">
        Ảnh đang được xử lý…
      </div>
    );
  }

  if (preview.isLoading) {
    return (
      <div className="grid aspect-video place-items-center rounded-md border border-border-subtle bg-background text-[9px] text-muted-foreground">
        Đang tải preview…
      </div>
    );
  }

  if (preview.isError || !preview.data?.url || imageFailed) {
    return (
      <div className="grid aspect-video place-items-center gap-2 rounded-md border border-warning/30 bg-warning-bg p-3 text-center text-[9px] text-warning">
        <span>Không tải được ảnh preview.</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setImageFailed(false);
            void preview.refetch();
          }}
        >
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <img
      src={preview.data.url}
      alt={`Generated visual beat ${visualBeatId}`}
      className="aspect-video w-full rounded-md border border-border-subtle bg-background object-cover"
      loading="lazy"
      onError={() => setImageFailed(true)}
    />
  );
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <label className="grid gap-1 text-[10px] text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function asAspectRatio(value: string | undefined): MediaAspectRatio {
  return value === "9:16" || value === "1:1" || value === "4:3" || value === "3:4"
    ? value
    : "16:9";
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Generation request thất bại.";
}
