"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RenderFailure } from "@/features/render/components/RenderFailure";
import { RenderPreview } from "@/features/render/components/RenderPreview";
import { RenderProgress } from "@/features/render/components/RenderProgress";
import { useChapterRender } from "@/features/render/hooks/useChapterRender";

export function ChapterRenderTab({ projectId, chapterId }: Readonly<{ projectId: number; chapterId: number }>) {
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const render = useChapterRender({
    projectId,
    chapterId,
    resolution,
    format: "mp4",
    maxAuthorizedCost: "0.500000",
  });
  const isSubmitting = render.status === "SUBMITTING";

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
        <Button onClick={() => render.render()} isLoading={isSubmitting} disabled={!render.canRender}>
          {isSubmitting ? "Đang gửi render…" : render.status === "READY" ? "Render lại Chapter" : render.canRender ? "Render Chapter" : "Approve toàn bộ keyframe để render"}
        </Button>
      </div>

      {render.mediaMessage ? <p className="text-sm text-slate-300">{render.mediaMessage}</p> : null}
      {isSubmitting ? <p className="text-sm text-slate-300" role="status">Đang gửi render job…</p> : null}
      {render.job ? <RenderProgress job={render.job} status={render.status} progress={render.progress} /> : null}
      {render.error ? <RenderFailure message={render.error} onRetry={render.retry} retryDisabled={isSubmitting} /> : null}
      {render.artifact ? <RenderPreview artifact={render.artifact} /> : null}
    </section>
  );
}
