import { useEffect, useState } from "react";
import type { DesktopChapterDetails, DesktopTimeline } from "@narrativex/client-contracts";
import { Check, Image as ImageIcon, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, FeaturePage } from "../../workspace/components/FeaturePage";
import {
  useAnalyzeChapter,
  useCreateMediaJob,
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
  const [qualityTier, setQualityTier] = useState<"DRAFT" | "STANDARD" | "HIGH">("STANDARD");
  const [imageStyle, setImageStyle] = useState<"CINEMATIC" | "STORYBOOK_WATERCOLOR">("CINEMATIC");
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [mediaJobId, setMediaJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const generationJob = useGenerationJob(generationJobId);
  const mediaJob = useMediaJob(mediaJobId);

  useEffect(() => {
    if (!chapterId && chapters[0]) setChapterId(chapters[0].id);
  }, [chapterId, chapters]);

  const beats = timeline?.beats.filter((beat) => beat.chapterId === chapterId) ?? [];

  async function runAnalysis() {
    if (!chapterId) return;
    setNotice(null);
    try {
      const job = await analyze.mutateAsync({ projectId, chapterId });
      setGenerationJobId(job.jobId);
      setMediaJobId(null);
      setNotice(`Analysis ${job.jobId.slice(0, 8)} đã được queue.`);
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  async function estimateCost() {
    if (!chapterId) return;
    setNotice(null);
    try {
      const result = await estimate.mutateAsync({ projectId, chapterId, qualityTier });
      setNotice(
        `Ước tính ${result.estimatedCost} ${result.currency} cho ${result.visualBeatCount} visual beat.`,
      );
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  async function generateImages() {
    if (!chapterId) return;
    setNotice(null);
    try {
      const job = await createJob.mutateAsync({
        projectId,
        chapterId,
        request: {
          productionMode: "IMAGE_MOTION",
          aspectRatio: asAspectRatio(timeline?.aspectRatio),
          qualityTier,
          maxAuthorizedCost: 25,
          imageStyle,
        },
      });
      setGenerationJobId(job.jobId);
      setMediaJobId(job.jobId);
      setNotice(`Media job ${job.jobId.slice(0, 8)} đã được queue.`);
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  return (
    <FeaturePage
      title="Image Generation"
      description="Analyze chapter, estimate cost, generate image assets và review từng media item trong generation feature riêng."
      actions={
        <Button size="sm" onClick={() => void generateImages()} disabled={!chapterId || createJob.isPending}>
          <Sparkles size={14} /> {createJob.isPending ? "Queuing…" : "Generate images"}
        </Button>
      }
    >
      <div className="grid gap-3">
        <section className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
          <Field label="Chapter">
            <Select value={chapterId || undefined} onValueChange={setChapterId}>
              <SelectTrigger className="min-w-[230px]"><SelectValue placeholder="Chọn chapter" /></SelectTrigger>
              <SelectContent>
                {chapters.map((chapter) => (
                  <SelectItem key={chapter.id} value={chapter.id}>{chapter.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Quality">
            <Select value={qualityTier} onValueChange={(value) => setQualityTier(value as typeof qualityTier)}>
              <SelectTrigger className="min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="STANDARD">Standard</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Image style">
            <Select value={imageStyle} onValueChange={(value) => setImageStyle(value as typeof imageStyle)}>
              <SelectTrigger className="min-w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CINEMATIC">Cinematic</SelectItem>
                <SelectItem value="STORYBOOK_WATERCOLOR">Storybook watercolor</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Button variant="outline" onClick={() => void runAnalysis()} disabled={!chapterId || analyze.isPending}>
            Analyze
          </Button>
          <Button variant="outline" onClick={() => void estimateCost()} disabled={!chapterId || estimate.isPending}>
            Estimate cost
          </Button>
        </section>

        {notice && <p className="text-[10px] text-muted-foreground">{notice}</p>}
        {generationJob.data && (
          <div className="rounded-md border border-border bg-card p-3 text-[10px] text-muted-foreground">
            Generation {generationJob.data.jobId.slice(0, 8)} · {generationJob.data.status} · {Math.round(generationJob.data.progress * 100)}%
          </div>
        )}

        <section className="grid grid-cols-[minmax(240px,.7fr)_minmax(0,1.3fr)] gap-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <span className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">Visual beats</span>
            <div className="mt-2 grid gap-2">
              {beats.map((beat) => (
                <div key={beat.visualBeatId} className="rounded-md border border-border-subtle bg-popover p-2">
                  <strong className="text-[10px]">{beat.title}</strong>
                  <p className="mt-1 text-[9px] leading-4 text-muted-foreground">{beat.visualIntent}</p>
                </div>
              ))}
              {!beats.length && (
                <EmptyState title="Chưa có visual beat" description="Analyze chapter để tạo scene/visual beat trước." />
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3">
            <span className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">Media review</span>
            <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
              {mediaJob.data?.items.map((item) => (
                <article key={item.id} className="grid gap-2 rounded-md border border-border-subtle bg-popover p-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon size={16} className="text-primary-hover" />
                    <strong className="truncate text-[10px]">{item.visualBeatId}</strong>
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {item.executionStatus} · {item.reviewStatus}
                  </span>
                  {item.reviewStatus === "NEEDS_REVIEW" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => void review.mutateAsync({ itemId: item.id, jobId: mediaJobId ?? undefined, review: { decision: "APPROVED", rowVersion: item.rowVersion } })}
                        disabled={review.isPending}
                      >
                        <Check size={12} /> Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void review.mutateAsync({ itemId: item.id, jobId: mediaJobId ?? undefined, review: { decision: "REJECTED", rowVersion: item.rowVersion } })}
                        disabled={review.isPending}
                      >
                        <X size={12} /> Reject
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </div>
            {!mediaJob.data?.items.length && (
              <EmptyState title="Chưa có media job" description="Generate images để theo dõi và review output." />
            )}
          </div>
        </section>
      </div>
    </FeaturePage>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return <label className="grid gap-1 text-[10px] text-muted-foreground"><span>{label}</span>{children}</label>;
}

function asAspectRatio(value: string | undefined): "16:9" | "9:16" | "1:1" | "4:3" | "3:4" {
  return value === "9:16" || value === "1:1" || value === "4:3" || value === "3:4" ? value : "16:9";
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Generation request thất bại.";
}
