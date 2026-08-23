"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RenderFailure } from "@/features/render/components/RenderFailure";
import { RenderPreview } from "@/features/render/components/RenderPreview";
import { RenderProgress } from "@/features/render/components/RenderProgress";
import { useChapterRender } from "@/features/render/hooks/useChapterRender";

export function ChapterRenderTab({ projectId, chapterId }: Readonly<{ projectId: number; chapterId: number }>) {
  const render = useChapterRender({ projectId, chapterId });
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const media = render.media;
  const ready = Boolean(
    media.details &&
      media.details.totalItems > 0 &&
      media.details.readyItems === media.details.totalItems &&
      media.details.reviewItems === 0 &&
      media.job?.mediaPlanId &&
      media.job.mediaPlanRevision,
  );

  const startRender = () => {
    if (!ready || !media.job?.mediaPlanId || !media.job.mediaPlanRevision) return;
    render.renderChapter({
      mediaPlanId: media.job.mediaPlanId,
      mediaPlanRevision: media.job.mediaPlanRevision,
      resolution,
      format: "mp4",
      maxAuthorizedCost: "0.500000",
    });
  };

  return (
    <section className="space-y-5 rounded-2xl border border-border-dark bg-surface p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">Render &amp; export</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-100">IMAGE_MOTION render</h2>
        <p className="mt-1 text-sm text-slate-400">Render chỉ dùng đúng plan revision và các keyframe đã approve.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-300">
          Resolution
          <select
            className="mt-2 block min-h-11 rounded-lg border border-border-dark bg-surface-panel px-3 py-2 text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            value={resolution}
            onChange={(event) => setResolution(event.target.value as "720p" | "1080p")}
          >
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
          </select>
        </label>
        <Button onClick={startRender} isLoading={render.isPending} disabled={!ready || render.isActive}>
          {render.isPending ? "Đang xếp hàng…" : ready ? "Render Chapter" : "Approve toàn bộ keyframe để render"}
        </Button>
      </div>

      {media.message ? <p className="text-sm text-slate-300">{media.message}</p> : null}
      {render.job ? <RenderProgress job={render.job} /> : null}
      {render.errorMessage ? <RenderFailure message={render.errorMessage} onRetry={render.retry} retryDisabled={render.isPending} /> : null}
      {render.artifact ? <RenderPreview artifact={render.artifact} /> : null}
    </section>
  );
}
